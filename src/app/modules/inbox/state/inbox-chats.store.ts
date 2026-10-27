import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, debounceTime, firstValueFrom, merge, map } from 'rxjs';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxChatsApiService } from '../data-access/inbox-chats-api.service';
import { InboxChatRowDto } from '../models/inbox-chat.dto';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

/** Live events arrive in bursts (a decision touches several people); one reload per burst. */
const REALTIME_DEBOUNCE_MS = 400;

export type InboxChatFilter = 'all' | 'pending';

interface InboxChatsState {
  readonly rows: readonly InboxChatRowDto[];
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  /** All chats, or only those with something waiting on the user. */
  readonly filter: InboxChatFilter;
  /** Pending type filter ("source:kind"), null = every type. */
  readonly kind: string | null;
  /** Favorite chats (conversation ids): pinned at the top of their section. Per viewer, saved on the server. */
  readonly favorites: ReadonlySet<string>;
  /** A 1-on-1 chat just started from the search, shown until the list has it (an empty chat is not listed). */
  readonly started: InboxChatRowDto | null;
  /** The inbox page shows History instead of a chat (opened from the sidebar's "+" menu or a chat's info panel). */
  readonly history: boolean;
  /** "Delegate my approvals" is open (from the sidebar's "+" menu). */
  readonly delegateOpen: boolean;
}

const initialState: InboxChatsState = {
  rows: [], loaded: false, loading: false, error: null, filter: 'all', kind: null, favorites: new Set(), started: null,
  history: false, delegateOpen: false
};

function extractError(err: any, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

/**
 * The inbox's chats (people, groups, case groups), shared by the sub-sidebar list and the inbox page. Reloads on any
 * inbox change or new message, since a new case card or message moves a chat to the top.
 */
export const InboxChatsStore = signalStore(
  { providedIn: 'root' },
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
          if (mine !== request) return;
          const started = store.started();
          patchState(store, {
            rows, loaded: true, loading: false, favorites: new Set(rows.filter((r) => r.isFavorite).map((r) => r.conversationId)),
            started: started && rows.some((r) => r.conversationId === started.conversationId) ? null : started
          });
        } catch (err) {
          if (mine === request) patchState(store, { loading: false, error: extractError(err, 'Could not load your chats.') });
        }
      },
      /** The open chat was read: its unread badge clears without a reload. */
      markRead(conversationId: string): void {
        if (store.rows().some((r) => r.conversationId === conversationId && r.unread > 0))
          patchState(store, { rows: store.rows().map((r) => (r.conversationId === conversationId ? { ...r, unread: 0 } : r)) });
      },
      setFilter(filter: InboxChatFilter): void {
        patchState(store, { filter, kind: null });
      },
      setKind(kind: string | null): void {
        patchState(store, { kind });
      },
      setStarted(started: InboxChatRowDto | null): void {
        patchState(store, { started });
      },
      setHistory(history: boolean): void {
        patchState(store, { history });
      },
      setDelegateOpen(delegateOpen: boolean): void {
        patchState(store, { delegateOpen });
      },
      /** Mutes or unmutes a chat at once; the server keeps it. A failed save puts it back. */
      async toggleMuted(conversationId: string): Promise<boolean> {
        const muted = !store.rows().find((r) => r.conversationId === conversationId)?.isMuted;
        const apply = (on: boolean) =>
          patchState(store, { rows: store.rows().map((r) => (r.conversationId === conversationId ? { ...r, isMuted: on } : r)) });
        apply(muted);
        try {
          await firstValueFrom(api.setMuted(conversationId, muted));
          return true;
        } catch {
          apply(!muted);
          return false;
        }
      },
      /** Pins or unpins a chat at once; the server keeps it. A failed save puts it back. */
      async toggleFavorite(conversationId: string): Promise<void> {
        const favorite = !store.favorites().has(conversationId);
        const apply = (on: boolean) => {
          const next = new Set(store.favorites());
          if (on) next.add(conversationId);
          else next.delete(conversationId);
          patchState(store, { favorites: next });
        };
        apply(favorite);
        try {
          await firstValueFrom(api.setFavorite(conversationId, favorite));
        } catch {
          apply(!favorite);
        }
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService)) => {
    let subscription: Subscription | null = null;
    return {
      onInit(): void {
        subscription = merge(
          realtime.inboxChanged$.pipe(map(() => undefined)),
          realtime.messageCreated$.pipe(map(() => undefined)),
          realtime.participantAdded$.pipe(map(() => undefined)),
          realtime.reconnected$
        ).pipe(debounceTime(REALTIME_DEBOUNCE_MS)).subscribe(() => { if (store.loaded()) void store.load(); });
      },
      onDestroy(): void {
        subscription?.unsubscribe();
      }
    };
  })
);
