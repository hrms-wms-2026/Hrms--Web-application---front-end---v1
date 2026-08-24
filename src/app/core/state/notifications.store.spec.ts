import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsStore } from './notifications.store';
import { NotificationApiService } from '../services/notification-api.service';

describe('NotificationsStore', () => {
  function setup(apiOverrides: Partial<NotificationApiService> = {}) {
    const api = {
      getUnreadCount: vi.fn().mockReturnValue(of({ count: 2 })),
      getMine: vi.fn().mockReturnValue(of([{
        id: 'n1', templateCode: 'x', title: 'Hello', body: 'World',
        relatedEntityType: 'task_creation_request', relatedEntityId: 'r1',
        isRead: false, readAt: null, createdAt: '2026-08-17T00:00:00Z'
      }])),
      markRead: vi.fn().mockReturnValue(of(undefined)),
      markAllRead: vi.fn().mockReturnValue(of(undefined)),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [NotificationsStore, { provide: NotificationApiService, useValue: api }]
    });
    return { store: TestBed.inject(NotificationsStore), api };
  }

  it('refreshUnreadCount updates unreadCount', async () => {
    const { store } = setup();
    await store.refreshUnreadCount();
    expect(store.unreadCount()).toBe(2);
  });

  it('loadMine maps notification items', async () => {
    const { store } = setup();
    await store.loadMine();
    expect(store.items().length).toBe(1);
    expect(store.items()[0].title).toBe('Hello');
  });

  it('markRead decrements unreadCount', async () => {
    const { store } = setup();
    await store.refreshUnreadCount();
    await store.loadMine();
    await store.markRead('n1');
    expect(store.unreadCount()).toBe(1);
    expect(store.items()[0].isRead).toBe(true);
  });

  it('refreshUnreadCount can be invoked repeatedly for polling', async () => {
    const { store, api } = setup();
    await store.refreshUnreadCount();
    await store.refreshUnreadCount();
    expect(api.getUnreadCount).toHaveBeenCalledTimes(2);
  });
});
