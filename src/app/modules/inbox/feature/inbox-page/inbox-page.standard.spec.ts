import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TrayPresenceStore } from '../../../../core/tray-presence/state/tray-presence.store';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { ApprovalDelegatesApiService } from '../../data-access/approval-delegates-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxCapability, InboxItemDto, InboxKindDescriptorDto } from '../../models/inbox.dto';
import { InboxPageComponent } from './inbox-page.component';

/** FS2: tabs + counts, URL-synced filters, About me, bulk, History, group by employee, delegate menu. */

function item(id: string, extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'leave', kind: 'request', id, category: 'request', actionType: 'annual', title: `Annual leave ${id}`, subtitle: null,
    status: 'pending', direction: 'received', severity: null, contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Pat' }, requestedTo: null, createdAt: '2026-10-13T08:00:00Z', updatedAt: '2026-10-13T08:00:00Z',
    availableActions: [
      { key: 'approve', label: 'Approve', tone: 'primary', needsComment: false, needsPayload: false },
      { key: 'reject', label: 'Reject', tone: 'danger', needsComment: true, needsPayload: false }
    ],
    unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

const KINDS: InboxKindDescriptorDto[] = [
  { source: 'leave', kind: 'request', label: 'Leave request', category: 'request', capabilities: InboxCapability.Bulk, detailRenderer: null },
  { source: 'attendance', kind: 'alert', label: 'Attendance alert', category: 'alert', capabilities: InboxCapability.Bulk, detailRenderer: null },
  { source: 'work', kind: 'approval', label: 'Work request', category: 'request', capabilities: 0, detailRenderer: null }
];

describe('InboxPageComponent (FS2)', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let queryParams: Record<string, string>;
  let permissions: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    queryParams = {};
    permissions = [];
    api = {
      list: vi.fn(() => of({ items: [item('l1'), item('l2'), item('w1', { source: 'work', kind: 'approval', actionType: 'task.edit' })], total: 3, page: 1, pageSize: 25 })),
      filters: vi.fn(() => of([])),
      counts: vi.fn(() => of({ pendingReceived: 3, unreadMessages: 0, openAlerts: 21, byKind: { 'leave:request': 2, 'work:approval': 1, 'attendance:alert': 21 } })),
      kinds: vi.fn(() => of(KINDS)),
      detail: vi.fn(),
      runAction: vi.fn(() => of({ affectedEmployeeIds: [], message: null })),
      history: vi.fn(() => of({
        items: [{
          journalId: 'j1', source: 'leave', kind: 'request', itemId: 'l9', action: 'approve', actionLabel: 'Approved', decidedAt: new Date().toISOString(),
          comment: 'Enjoy', isReverted: false, canRevert: true, revertableUntil: new Date(Date.now() + 600_000).toISOString(), title: 'Annual leave - Sam', item: null
        }],
        total: 1, page: 1, pageSize: 25
      })),
      bulk: vi.fn(() => of({ succeeded: [], failed: [] }))
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [
        { provide: InboxApiService, useValue: api },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: new Subject(), reconnected$: new Subject(), messageCreated$: new Subject(), participantAdded$: new Subject() } },
        { provide: ConversationsApiService, useValue: { searchPeople: vi.fn(() => of([])) } },
        { provide: ApprovalDelegatesApiService, useValue: { list: vi.fn(() => of([])), create: vi.fn(), remove: vi.fn() } },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn(() => of({ items: [] })) } },
        { provide: TaskApiService, useValue: { uploadPendingFile: vi.fn(), deletePendingFile: vi.fn(), getFileUrl: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: signal(false), employeeId: signal('me') } },
        { provide: PermissionService, useValue: { hasModule: () => false, hasPermission: (p: string) => permissions.includes(p) } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => true } },
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            paramMap: new BehaviorSubject<ParamMap>(convertToParamMap({})).asObservable(),
            snapshot: { queryParamMap: convertToParamMap(queryParams) }
          })
        },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(InboxPageComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const tab = (label: string) => Array.from(el.querySelectorAll('[role="tab"]')).find((t) => t.textContent?.includes(label)) as HTMLElement;
    const settle = async () => { await vi.advanceTimersByTimeAsync(0); fixture.detectChanges(); };
    return { fixture, el, q, tab, settle };
  }

  const lastQuery = () => api['list'].mock.calls.at(-1)![0];
  const lastUrl = () => router.navigate.mock.calls.filter((c) => Array.isArray(c[0]) && c[0].length === 0).at(-1)?.[1];

  it('restores tab, direction, search and filters from the URL', async () => {
    queryParams = { tab: 'alerts', dir: 'received', q: 'pat', source: 'attendance', kind: 'alert', employee: 'e1' };
    const { tab } = await render();

    expect(lastQuery()).toMatchObject({
      category: ['alert'], direction: ['received'], search: 'pat', source: ['attendance'], facets: { kind: ['alert'], employee: ['e1'] }
    });
    expect(tab('Alerts').getAttribute('aria-selected')).toBe('true');
  });

  it('writes every change back to the URL without adding history entries', async () => {
    const { tab, settle, q } = await render();

    tab('Alerts').click();
    await settle();
    expect(lastUrl()).toEqual(expect.objectContaining({ queryParams: { tab: 'alerts' }, replaceUrl: true }));

    q('inbox-direction-received')!.click();
    await settle();
    expect(lastUrl()!.queryParams).toEqual({ tab: 'alerts', dir: 'received' });
  });

  it('labels the tabs with what needs the caller per category', async () => {
    const { tab } = await render();

    expect(tab('All').textContent).toContain('24');
    expect(tab('Requests').textContent).toContain('3');
    expect(tab('Alerts').textContent).toContain('21');
    expect(tab('History')).toBeTruthy();
  });

  it('About me lists info items about the caller', async () => {
    const { q, settle } = await render();

    q('inbox-direction-about')!.click();
    await settle();

    expect(lastQuery()).toMatchObject({ direction: ['info'], facets: { employee: ['me'] } });
  });

  it('History lists the decisions taken, with an undo chip inside the window', async () => {
    const { tab, settle, q, el } = await render();

    tab('History').click();
    await settle();

    expect(api['history']).toHaveBeenCalled();
    const row = q('inbox-history-row')!;
    expect(row.textContent).toContain('Annual leave - Sam');
    expect(row.textContent).toContain('Decided Approved');
    expect(el.querySelector('[data-testid="inbox-table"]')).toBeNull();

    q('inbox-history-revert')!.click();
    await settle();
    expect(api['runAction']).toHaveBeenCalledWith({ source: 'leave', kind: 'request', id: 'l9' }, 'revert', {});
  });

  it('bulk: only bulk-capable rows can be selected; a partial failure is listed', async () => {
    api['bulk'].mockReturnValueOnce(of({
      succeeded: [{ source: 'leave', kind: 'request', id: 'l1' }],
      failed: [{ ref: { source: 'leave', kind: 'request', id: 'l2' }, message: 'Already decided.' }]
    }));
    const { fixture, el, settle } = await render();
    const page = fixture.componentInstance as unknown as { isSelectable: (i: InboxItemDto) => boolean; onRowSelection(e: { row: InboxItemDto; selected: boolean }): void };

    expect(el.querySelector('[data-testid="data-table-select-all"]')).not.toBeNull();
    expect(page.isSelectable(item('w1', { source: 'work', kind: 'approval' }))).toBe(false);
    page.onRowSelection({ row: item('l1'), selected: true });
    page.onRowSelection({ row: item('l2'), selected: true });
    await settle();

    const approve = Array.from(el.querySelectorAll('app-bulk-action-bar button')).find((b) => b.textContent?.includes('Approve')) as HTMLButtonElement;
    approve.click();
    await settle();

    expect(api['bulk']).toHaveBeenCalledWith({
      action: 'approve', items: [{ source: 'leave', kind: 'request', id: 'l1' }, { source: 'leave', kind: 'request', id: 'l2' }], comment: null, outcome: null
    });
    expect(document.body.textContent).toContain('Already decided.');
  });

  it('groups alerts by employee with counts', async () => {
    api['list'].mockReturnValue(of({
      items: [
        item('a1', { source: 'attendance', kind: 'alert', category: 'alert', requestedBy: { id: 'e1', name: 'Pat' } }),
        item('a2', { source: 'attendance', kind: 'alert', category: 'alert', requestedBy: { id: 'e1', name: 'Pat' } }),
        item('a3', { source: 'attendance', kind: 'alert', category: 'alert', requestedBy: { id: 'e2', name: 'Sam' } })
      ],
      total: 3, page: 1, pageSize: 25
    }));
    queryParams = { tab: 'alerts' };
    const { q, settle, el } = await render();

    q('inbox-group-toggle')!.click();
    await settle();

    const groups = Array.from(el.querySelectorAll('[data-testid="inbox-group"]'));
    expect(groups.map((g) => g.querySelector('[data-testid="inbox-group-header"]')?.textContent?.replace(/\s+/g, ' ').trim()))
      .toEqual([expect.stringContaining('Pat · 2'), expect.stringContaining('Sam · 1')]);
    (groups[0].querySelector('[data-testid="inbox-group-header"]') as HTMLElement).click();
    await settle();
    expect(el.querySelectorAll('[data-testid="inbox-group"]')[0].querySelectorAll('[data-testid="inbox-row"]')).toHaveLength(0);
  });

  it('offers "Delegate my approvals" only to leave approvers', async () => {
    expect((await render()).q('inbox-delegate')).toBeNull();
  });

  it('opens the delegate modal for a leave approver', async () => {
    permissions = ['leave:approve'];
    const { q, settle } = await render();

    q('inbox-delegate')!.click();
    await settle();

    expect(document.body.textContent).toContain('Delegate my approvals');
  });
});
