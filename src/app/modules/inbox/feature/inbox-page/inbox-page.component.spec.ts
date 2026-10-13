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
import { InboxItemDto } from '../../models/inbox.dto';
import { InboxStore } from '../../state/inbox.store';
import { InboxPageComponent } from './inbox-page.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';

function item(id: string, extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'work', kind: 'approval', id, category: 'request', actionType: 'task.edit', title: `Target ${id}`, subtitle: null,
    status: 'pending', direction: 'received', severity: null, contextType: 'project', contextId: 'p1', contextName: 'Apollo',
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: { id: 'e2', name: 'Anu' }, createdAt: '2026-10-13T08:00:00Z',
    updatedAt: '2026-10-13T08:00:00Z', availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

describe('InboxPageComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let params: BehaviorSubject<ParamMap>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let conversations: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      list: vi.fn(() => of({ items: [item('a1', { unreadMessages: 2 }), item('a2', { category: 'alert', kind: 'monitor_alert', actionType: 'monitor.task_overdue', status: 'open', severity: 'high' })], total: 2, page: 1, pageSize: 25 })),
      filters: vi.fn(() => of([
        { key: 'project', label: 'Project', multi: true, options: [{ value: 'p1', label: 'Apollo' }] },
        { key: 'module', label: 'Module', multi: true, options: [{ value: 'm1', label: 'Payments' }] }
      ])),
      counts: vi.fn(() => of({ pendingReceived: 1, unreadMessages: 2, openAlerts: 1 })),
      detail: vi.fn(() => of({ item: item('a1', { availableActions: [{ key: 'approve', label: 'Approve', tone: 'primary', needsComment: false, needsPayload: false }] }), steps: [], summary: null, changeSet: [], explanation: null, explanationDetails: null, target: { route: ['/work', 'p1', 'board'], label: 'Open task', queryParams: { taskId: 't1' } }, editablePayloadJson: null })),
      runAction: vi.fn(() => of({ affectedEmployeeIds: [], message: null }))
    };
    params = new BehaviorSubject(convertToParamMap({}));
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    notifications = { success: vi.fn(), error: vi.fn() };
    conversations = {
      open: vi.fn(() => of({ id: 'c1', source: 'work', kind: 'approval', subjectId: 'a1', title: 't', projectId: 'p1', participants: [], messages: [], hasMoreMessages: false, lastReadAt: null })),
      markRead: vi.fn(() => of(undefined)),
      messages: vi.fn(), post: vi.fn(), addParticipants: vi.fn()
    };
    TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [
        { provide: InboxApiService, useValue: api },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: new Subject(), reconnected$: new Subject(), messageCreated$: new Subject(), participantAdded$: new Subject() } },
        { provide: ConversationsApiService, useValue: conversations },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn(() => of({ items: [] })) } },
        { provide: TaskApiService, useValue: { uploadPendingFile: vi.fn(), deletePendingFile: vi.fn(), getFileUrl: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: signal(false) } },
        { provide: PermissionService, useValue: { hasModule: () => false } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifications }
      ]
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(InboxPageComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, store: TestBed.inject(InboxStore) };
  }

  it('lists requests and alerts with project, type, status and the unread-chat dot', async () => {
    const { el } = await render();
    const rows = Array.from(el.querySelectorAll('[data-testid="inbox-row"]')) as HTMLElement[];

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Update task details');
    expect(rows[0].textContent).toContain('Apollo');
    expect(rows[0].querySelector('[data-testid="inbox-row-unread"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('Task past its due date');
    expect(rows[1].querySelector('[data-testid="inbox-status"]')?.textContent).toContain('Open');
  });

  it('switches category with the tabs and direction with the segment', async () => {
    const { fixture, el } = await render();

    (Array.from(el.querySelectorAll('[role="tab"]')).find((t) => t.textContent?.includes('Alerts')) as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(api['list']).toHaveBeenLastCalledWith(expect.objectContaining({ category: ['alert'], page: 1 }));

    (el.querySelector('[data-testid="inbox-direction-sent"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(api['list']).toHaveBeenLastCalledWith(expect.objectContaining({ category: ['alert'], direction: ['sent'] }));
  });

  it('maps filter-bar values to query fields, module to a facet and "requested on" to a from date', async () => {
    const { fixture } = await render();
    const page = fixture.componentInstance as unknown as { onFilterChanged(e: { key: string; values: string[] }): void };

    page.onFilterChanged({ key: 'project', values: ['p1'] });
    page.onFilterChanged({ key: 'module', values: ['m1'] });
    page.onFilterChanged({ key: 'requestedOn', values: ['7'] });
    await vi.advanceTimersByTimeAsync(0);

    const last = api['list'].mock.calls.at(-1)![0];
    expect(last.project).toEqual(['p1']);
    expect(last.facets).toEqual({ module: ['m1'] });
    expect(typeof last.from).toBe('string');
  });

  it('debounces the search box', async () => {
    const { el } = await render();
    const input = el.querySelector('[data-testid="inbox-search"]') as HTMLInputElement;
    api['list'].mockClear();

    input.value = 'aud';
    input.dispatchEvent(new Event('input'));
    input.value = 'audit';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(299);
    expect(api['list']).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(api['list']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ search: 'audit' }));
  });

  it('selecting a row puts it in the URL; the URL selects the item and shows its card', async () => {
    const { fixture, el, store } = await render();

    (el.querySelector('[data-testid="inbox-row"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'work', 'approval', 'a1']);

    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(store.selectedRef()).toEqual({ source: 'work', kind: 'approval', id: 'a1' });
    expect(el.querySelector('[data-testid="inbox-card"]')).not.toBeNull();

    params.next(convertToParamMap({}));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(store.selectedRef()).toBeNull();
    expect(el.querySelector('[data-testid="inbox-card"]')).toBeNull();
  });

  it('runs a card action through the store and confirms it', async () => {
    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    const { fixture, el } = await render();

    (el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(api['runAction']).toHaveBeenCalledWith({ source: 'work', kind: 'approval', id: 'a1' }, 'approve', {});
    expect(notifications.success).toHaveBeenCalled();
  });

  it('reports a refused action', async () => {
    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    api['runAction'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'Only the approver can decide.' } })));
    const { el } = await render();

    (el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);

    expect(notifications.error).toHaveBeenCalledWith('Only the approver can decide.');
  });

  it('shows the item conversation inside the card; a "/" action runs like its button', async () => {
    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    const { fixture, el } = await render();

    expect(el.querySelector('[data-testid="inbox-card"] [data-testid="conversation-panel"]')).not.toBeNull();
    expect(conversations['open']).toHaveBeenCalledWith({ source: 'work', kind: 'approval', id: 'a1' });

    const panel = fixture.debugElement.query((d) => d.name === 'app-conversation-panel').componentInstance;
    panel.action.emit('approve');
    await vi.advanceTimersByTimeAsync(0);

    expect(api['runAction']).toHaveBeenCalledWith({ source: 'work', kind: 'approval', id: 'a1' }, 'approve', {});
  });

  it('still shows the conversation when the item detail cannot be loaded', async () => {
    api['detail'].mockReturnValue(throwError(() => ({ status: 404 })));
    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    const { el } = await render();

    expect(el.querySelector('[data-testid="inbox-card"] [data-testid="conversation-panel"]')).not.toBeNull();
    expect(conversations['open']).toHaveBeenCalledWith({ source: 'work', kind: 'approval', id: 'a1' });
  });

  it('opens the item target with its query params', async () => {
    params.next(convertToParamMap({ source: 'work', kind: 'approval', id: 'a1' }));
    const { el } = await render();

    (el.querySelector('[data-testid="inbox-card-open-target"]') as HTMLButtonElement).click();

    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1', 'board'], { queryParams: { taskId: 't1' } });
  });

  it('shows "nothing yet" for an empty inbox and "no match" once filtered', async () => {
    api['list'].mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 25 }));
    const { fixture, el, store } = await render();
    expect(el.textContent).toContain('Nothing here yet');

    await store.applyFilter({ category: ['alert'] });
    fixture.detectChanges();
    expect(el.textContent).toContain('Nothing matches these filters');
  });

  it('pages when there are more items than fit', async () => {
    api['list'].mockReturnValue(of({ items: [item('a1')], total: 60, page: 1, pageSize: 25 }));
    const { fixture, el } = await render();

    expect(el.textContent).toContain('Page 1 of 3');
    (el.querySelector('[data-testid="inbox-next"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(api['list']).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});
