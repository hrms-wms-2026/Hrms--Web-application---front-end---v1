import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, debounceTime, firstValueFrom, merge, map } from 'rxjs';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxChatsApiService } from '../data-access/inbox-chats-api.service';
import { InboxChatRowDto } from '../models/inbox-chat.dto';

/** Live events arrive in bursts (a decision touches several people); one reload per burst. */
const REALTIME_DEBOUNCE_MS = 400;

interface InboxChatsState {
  readonly rows: readonly InboxChatRowDto[];
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: InboxChatsState = { rows: [], loaded: false, loading: false, error: null };

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

/** The inbox's chat list (people, groups, case groups). Provided by the inbox page. Reloads on any inbox change or
 *  new message, since a new case card or message moves a chat to the top. */
export const InboxChatsStore = signalStore(
  withState<InboxChatsState>(initialState),
  withComputed((store) => ({
    pendingCount: computed(() => store.rows().reduce((n, r) => n + r.pending.length, 0))
  })),
  withMethods((store, api = inject(InboxChatsApiService)) => {
    let request = 0;
    return {
      async load(): Promise<void> {
        const mine = ++request;
        patchState(store, { loading: true, error: null });
        try {
          const rows = await firstValueFrom(api.list());
          if (mine === request) patchState(store, { rows, loaded: true, loading: false });
        } catch (err) {
          if (mine === request) patchState(store, { loading: false, error: extractError(err, 'Could not load your chats.') });
        }
      },
      /** The open chat was read: its unread badge clears without a reload. */
      markRead(conversationId: string): void {
        if (store.rows().some((r) => r.conversationId === conversationId && r.unread > 0))
          patchState(store, { rows: store.rows().map((r) => (r.conversationId === conversationId ? { ...r, unread: 0 } : r)) });
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService)) => {
    let subscription: Subscription | null = null;
    return {
      onInit(): void {
        void store.load();
        subscription = merge(
          realtime.inboxChanged$.pipe(map(() => undefined)),
          realtime.messageCreated$.pipe(map(() => undefined)),
          realtime.participantAdded$.pipe(map(() => undefined)),
          realtime.reconnected$
        ).pipe(debounceTime(REALTIME_DEBOUNCE_MS)).subscribe(() => void store.load());
      },
      onDestroy(): void {
        subscription?.unsubscribe();
      }
    };
  })
);
