import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { TrayPresenceStore } from '../../../core/tray-presence/state/tray-presence.store';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxChangedEvent } from '../../../core/realtime/inbox-realtime.models';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxItemDetailDto, InboxItemDto } from '../models/inbox.dto';
import { InboxStore } from './inbox.store';

function item(id: string, extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'work', kind: 'approval', id, category: 'request', actionType: 'task.edit', title: `Item ${id}`, subtitle: null,
    status: 'pending', direction: 'received', severity: null, contextType: 'project', contextId: 'p1', contextName: 'Apollo',
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: { id: 'e2', name: 'Anu' }, createdAt: '2026-10-13T08:00:00Z',
    updatedAt: '2026-10-13T08:00:00Z', availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

function detail(id: string): InboxItemDetailDto {
  return { item: item(id), steps: [], summary: null, changeSet: [], explanation: null, explanationDetails: null, target: null, editablePayloadJson: null };
}

describe('InboxStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let inboxChanged: Subject<InboxChangedEvent>;
  let reconnected: Subject<void>;
  let messageCreated: Subject<unknown>;
  let store: InstanceType<typeof InboxStore>;
  const authenticated = signal(false);

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      list: vi.fn(() => of({ items: [item('a1'), item('a2')], total: 2, page: 1, pageSize: 25 })),
      filters: vi.fn(() => of([{ key: 'project', label: 'Project', multi: true, options: [] }])),
      counts: vi.fn(() => of({ pendingReceived: 7, unreadMessages: 4, openAlerts: 1 })),
      detail: vi.fn((ref: { id: string }) => of(detail(ref.id))),
      runAction: vi.fn(() => of({ affectedEmployeeIds: [], message: null }))
    };
    inboxChanged = new Subject();
    reconnected = new Subject();
    messageCreated = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: InboxApiService, useValue: api },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: inboxChanged.asObservable(), reconnected$: reconnected.asObservable(), messageCreated$: messageCreated.asObservable() } },
        { provide: AuthStore, useValue: { authenticated } },
        { provide: PermissionService, useValue: { hasModule: () => false } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => true } }
      ]
    });
    authenticated.set(false);
    store = TestBed.inject(InboxStore);
  });

  it('loads the rail counts once the tenant workspace is ready (same gate as the bell)', async () => {
    TestBed.tick();
    expect(api['counts']).not.toHaveBeenCalled();

    authenticated.set(true);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);

    expect(api['counts']).toHaveBeenCalledTimes(1);
    expect(store.badgeCount()).toBe(11);
  });

  afterEach(() => vi.useRealTimers());

  it('loads the first page with the default query', async () => {
    await store.load();

    expect(api['list']).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(store.items().map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(store.total()).toBe(2);
    expect(store.loading()).toBe(false);
  });

  it('surfaces a list error', async () => {
    api['list'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'boom' } })));
    await store.load();
    expect(store.error()).toBe('boom');
  });

  it('applyFilter merges into the query, resets to page 1 and reloads', async () => {
    await store.setPage(3);
    await store.applyFilter({ category: ['alert'], project: ['p9'] });

    expect(api['list']).toHaveBeenLastCalledWith({ page: 1, pageSize: 25, category: ['alert'], project: ['p9'] });
    expect(store.query().category).toEqual(['alert']);
  });

  it('builds the rail badge from pending received + unread messages, capped at 9+', async () => {
    await store.loadCounts();
    expect(store.badgeCount()).toBe(11);
    expect(store.badgeLabel()).toBe('9+');

    api['counts'].mockReturnValueOnce(of({ pendingReceived: 2, unreadMessages: 1, openAlerts: 5 }));
    await store.loadCounts();
    expect(store.badgeLabel()).toBe('3');

    api['counts'].mockReturnValueOnce(of({ pendingReceived: 0, unreadMessages: 0, openAlerts: 0 }));
    await store.loadCounts();
    expect(store.badgeLabel()).toBe('');
  });

  it('select loads the detail and clearing the selection drops it', async () => {
    await store.select({ source: 'work', kind: 'approval', id: 'a2' });
    expect(store.detail()?.item.id).toBe('a2');
    expect(store.selectedRef()).toEqual({ source: 'work', kind: 'approval', id: 'a2' });

    await store.select(null);
    expect(store.detail()).toBeNull();
  });

  it('ignores a slow detail response for an item that is no longer selected', async () => {
    const slow = new Subject<InboxItemDetailDto>();
    api['detail'].mockReturnValueOnce(slow.asObservable());
    const first = store.select({ source: 'work', kind: 'approval', id: 'a1' });
    await store.select({ source: 'work', kind: 'approval', id: 'a2' });
    slow.next(detail('a1'));
    slow.complete();
    await first;

    expect(store.detail()?.item.id).toBe('a2');
  });

  it('runAction posts the action, then refreshes list, counts and the open detail', async () => {
    await store.load();
    await store.select({ source: 'work', kind: 'approval', id: 'a1' });
    api['list'].mockClear();
    api['counts'].mockClear();
    api['detail'].mockClear();

    const ok = await store.runAction({ source: 'work', kind: 'approval', id: 'a1' }, 'approve', { comment: 'fine' });

    expect(ok).toBe(true);
    expect(api['runAction']).toHaveBeenCalledWith({ source: 'work', kind: 'approval', id: 'a1' }, 'approve', { comment: 'fine' });
    expect(api['list']).toHaveBeenCalled();
    expect(api['counts']).toHaveBeenCalled();
    expect(api['detail']).toHaveBeenCalled();
    expect(store.busy()).toBe(false);
  });

  it('runAction keeps the error for the UI when the module refuses', async () => {
    api['runAction'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'Only the approver can decide.' } })));

    const ok = await store.runAction({ source: 'work', kind: 'approval', id: 'a1' }, 'approve');

    expect(ok).toBe(false);
    expect(store.actionError()).toBe('Only the approver can decide.');
    expect(store.actionErrorInline()).toBe(false);
  });

  it('marks a 422 refusal as a validation message about the edits, cleared by the next action', async () => {
    api['runAction'].mockReturnValueOnce(throwError(() => ({ status: 422, error: { detail: 'Overlaps another leave.' } })));
    const ref = { source: 'leave', kind: 'request', id: 'l1' };

    await store.runAction(ref, 'approve');
    expect(store.actionErrorInline()).toBe(true);

    await store.runAction(ref, 'approve');
    expect((store.actionError(), store.actionErrorInline())).toBe(false);
  });

  it('refreshes (debounced 500 ms) when the hub says the inbox changed, or after a reconnect', async () => {
    await store.load();
    api['list'].mockClear();
    api['counts'].mockClear();

    inboxChanged.next({ item: { source: 'work', kind: 'approval', id: 'a1' } });
    inboxChanged.next({ item: { source: 'work', kind: 'approval', id: 'a2' } });
    reconnected.next();
    await vi.advanceTimersByTimeAsync(499);
    expect(api['counts']).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(api['counts']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledTimes(1);
  });

  it('only refreshes counts on a realtime change while the inbox list has never been opened', async () => {
    inboxChanged.next({ item: { source: 'work', kind: 'approval', id: 'a1' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(api['counts']).toHaveBeenCalledTimes(1);
    expect(api['list']).not.toHaveBeenCalled();
  });

  it('refreshes only the counts (debounced) when a chat message arrives, so the unread badge follows', async () => {
    await store.load();
    api['list'].mockClear();
    api['counts'].mockClear();

    messageCreated.next({ conversationId: 'c1', message: {} });
    messageCreated.next({ conversationId: 'c1', message: {} });
    await vi.advanceTimersByTimeAsync(500);

    expect(api['counts']).toHaveBeenCalledTimes(1);
    expect(api['list']).not.toHaveBeenCalled();
  });

  it('loads the filter fields once', async () => {
    await store.loadFilters();
    expect(store.filterFields().map((f) => f.key)).toEqual(['project']);
  });
});
