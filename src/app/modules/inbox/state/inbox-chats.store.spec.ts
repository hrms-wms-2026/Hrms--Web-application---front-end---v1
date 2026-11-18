import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxChatsApiService } from '../data-access/inbox-chats-api.service';
import { InboxChatsStore } from './inbox-chats.store';

describe('InboxChatsStore', () => {
  let list: ReturnType<typeof vi.fn>;
  let store: InstanceType<typeof InboxChatsStore>;

  beforeEach(() => {
    list = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: InboxChatsApiService, useValue: { list } },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: new Subject(), messageCreated$: new Subject(), participantAdded$: new Subject(), reconnected$: new Subject() } }
      ]
    });
    store = TestBed.inject(InboxChatsStore);
  });

  it('ensureLoaded from the page and the sidebar sends one request while the first is in flight', async () => {
    const reply = new Subject<never[]>();
    list.mockReturnValueOnce(reply.asObservable());

    const page = store.ensureLoaded();
    const sidebar = store.ensureLoaded();
    reply.next([]);
    reply.complete();
    await Promise.all([page, sidebar]);

    expect(list).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);
  });

  it('ensureLoaded does nothing once loaded; load still reloads', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(list).toHaveBeenCalledTimes(1);

    await store.load();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
