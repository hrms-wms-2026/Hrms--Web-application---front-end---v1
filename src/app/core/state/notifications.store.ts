import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { NotificationApiService, NotificationItem, toNotificationItem } from '../services/notification-api.service';
import { toSafeErrorMessage } from '../services/error-handler.service';

interface NotificationsState {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null
};

function extractError(err: unknown, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationsState>(initialState),
  withMethods((store, api = inject(NotificationApiService)) => ({
    async refreshUnreadCount(): Promise<void> {
      try {
        const res = await firstValueFrom(api.getUnreadCount());
        patchState(store, { unreadCount: res.count, error: null });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to refresh unread count.') });
      }
    },

    async loadMine(unreadOnly = false): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dtos = await firstValueFrom(api.getMine(unreadOnly));
        patchState(store, {
          items: dtos.map(toNotificationItem),
          loading: false
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load notifications.'), loading: false });
      }
    },

    async markRead(id: string): Promise<void> {
      try {
        await firstValueFrom(api.markRead(id));
        const wasUnread = store.items().some((n) => n.id === id && !n.isRead);
        patchState(store, {
          items: store.items().map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date() } : n
          ),
          unreadCount: wasUnread ? Math.max(0, store.unreadCount() - 1) : store.unreadCount(),
          error: null
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to mark notification read.') });
      }
    },

    async markAllRead(): Promise<void> {
      try {
        await firstValueFrom(api.markAllRead());
        patchState(store, {
          items: store.items().map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date() })),
          unreadCount: 0,
          error: null
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to mark all notifications read.') });
      }
    }
  }))
);
