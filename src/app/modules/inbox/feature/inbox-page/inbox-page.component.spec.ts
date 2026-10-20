import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TrayPresenceStore } from '../../../../core/tray-presence/state/tray-presence.store';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { ApprovalDelegatesApiService } from '../../data-access/approval-delegates-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatRowDto } from '../../models/inbox-chat.dto';
import { InboxPageComponent } from './inbox-page.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';

function row(id: string, extra: Partial<InboxChatRowDto> = {}): InboxChatRowDto {
  return {
    conversationId: id, source: 'direct', kind: 'direct', subjectId: `pair-${id}`, type: 'direct', title: `Person ${id}`,
    otherEmployeeId: `emp-${id}`, avatarFileId: null, memberCount: 2, preview: 'You: hi', lastMessageAt: '2026-10-20T08:00:00Z',
    unread: 0, pending: [], caseItem: null, ...extra
  };
}

describe('InboxPageComponent', () => {
  let chatsApi: Record<string, ReturnType<typeof vi.fn>>;
  let params: BehaviorSubject<ParamMap>;
  let query: BehaviorSubject<ParamMap>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    chatsApi = {
      list: vi.fn(() => of([
        row('c1', { unread: 2 }),
        row('c2', { pending: [{ source: 'leave', kind: 'request', id: 'l1', title: 'Annual leave - Priya' }] }),
        row('c3', { source: 'group', kind: 'group', subjectId: 'g3', type: 'group', title: 'Payroll review', otherEmployeeId: null, memberCount: 4 })
      ])),
      forItem: vi.fn(() => of(row('c2'))),
      openDirect: vi.fn(() => of({ conversationId: 'c9', source: 'direct', kind: 'direct', subjectId: 'pair-c9' })),
      createGroup: vi.fn(), startCaseGroup: vi.fn(), renameGroup: vi.fn()
    };
    params = new BehaviorSubject(convertToParamMap({}));
    query = new BehaviorSubject(convertToParamMap({}));
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [
        { provide: InboxChatsApiService, useValue: chatsApi },
        {
          provide: InboxApiService, useValue: {
            list: vi.fn(() => of({ items: [], total: 0, page: 1, pageSize: 100 })), counts: vi.fn(() => of({ pendingReceived: 0, unreadMessages: 0, openAlerts: 0 })),
            kinds: vi.fn(() => of([])), detail: vi.fn(() => throwError(() => new Error('no detail'))), filters: vi.fn(() => of([])),
            personCases: vi.fn(() => of([])), personCaseMonths: vi.fn(() => of({ hireDate: null, months: [] }))
          }
        },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: new Subject(), reconnected$: new Subject(), messageCreated$: new Subject(), participantAdded$: new Subject(), messageUpdated$: new Subject(), messageDeleted$: new Subject(), participantRemoved$: new Subject() } },
        {
          provide: ConversationsApiService, useValue: {
            open: vi.fn(() => of({ id: 'c1', source: 'direct', kind: 'direct', subjectId: 'pair-c1', title: 'Direct message', projectId: null, participants: [], messages: [], hasMoreMessages: false, lastReadAt: null })),
            markRead: vi.fn(() => of(undefined)), searchPeople: vi.fn(() => of([])), messages: vi.fn(), post: vi.fn(), addParticipants: vi.fn()
          }
        },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn(() => of({ items: [] })) } },
        { provide: TaskApiService, useValue: { uploadPendingFile: vi.fn(), deletePendingFile: vi.fn(), getFileUrl: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: signal(false), employeeId: signal('me') } },
        { provide: PermissionService, useValue: { hasModule: () => false, hasPermission: () => false } },
        { provide: ApprovalDelegatesApiService, useValue: { list: vi.fn(() => of([])), create: vi.fn(), remove: vi.fn() } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable(), queryParamMap: query.asObservable(), snapshot: { queryParamMap: convertToParamMap({}) } } },
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
    return { fixture, el, rows: () => Array.from(el.querySelectorAll('[data-testid="chat-row"]')) as HTMLElement[] };
  }

  it('lists people and groups, with unread and pending badges; no chat open yet', async () => {
    const { el, rows } = await render();

    expect(el.querySelector('[data-testid="inbox-chat-empty"]')!.textContent).toContain('Select a chat');
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Person c1'), expect.stringContaining('Person c2'), expect.stringContaining('Payroll review')
    ]);
    expect(rows()[0].textContent).toContain('2');
    expect(rows()[1].textContent).toContain('1 pending');
  });

  it('Pending narrows the list to chats with something waiting on the user', async () => {
    const { fixture, el, rows } = await render();

    (el.querySelector('[data-testid="chat-filter-pending"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Person c2');
    expect(el.querySelector('[data-testid="chat-check-c2"]')).not.toBeNull();
  });

  it('opening a row navigates to its chat', async () => {
    const { rows } = await render();

    rows()[2].click();

    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'group', 'group', 'g3']);
  });

  it('a link to a request opens the 1-on-1 chat that carries it, with the case selected', async () => {
    await render();

    params.next(convertToParamMap({ source: 'leave', kind: 'request', id: 'l1' }));
    await vi.advanceTimersByTimeAsync(0);

    expect(chatsApi['forItem']).toHaveBeenCalledWith({ source: 'leave', kind: 'request', id: 'l1' });
    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'direct', 'direct', 'pair-c2'],
      { queryParams: { case: 'leave:request:l1' }, replaceUrl: true });
  });

  it('a link to a case the user has no chat for says so', async () => {
    chatsApi['forItem'].mockReturnValue(throwError(() => new Error('404')));
    const { fixture, el } = await render();

    params.next(convertToParamMap({ source: 'leave', kind: 'request', id: 'zz' }));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="inbox-chat-empty"]')!.textContent).toContain('not in any of your chats');
  });
});
