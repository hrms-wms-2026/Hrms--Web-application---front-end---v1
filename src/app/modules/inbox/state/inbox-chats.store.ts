import { computed, effect, inject, untracked } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, debounceTime, firstValueFrom, merge, map } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxChatsApiService } from '../data-access/inbox-chats-api.service';
import { InboxChatRowDto } from '../models/inbox-chat.dto';

/** Live events arrive in bursts (a decision touches several people); one reload per burst. */
const REALTIME_DEBOUNCE_MS = 400;
const FAVORITES_KEY = 'inbox.favoriteChats';

export type InboxChatFilter = 'all' | 'pending';

interface InboxChatsState {
  readonly rows: readonly InboxChatRowDto[];
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  /** All chats, or only those with something waiting on the user (bulk approval). */
  readonly filter: InboxChatFilter;
  /** Pending type filter ("source:kind"), null = every type. */
  readonly kind: string | null;
  /** Ticked chats (Pending only). */
  readonly selectedIds: ReadonlySet<string>;
  /** Favorite chats (conversation ids): pinned at the top of their section. Per viewer, kept in this browser. */
  readonly favorites: ReadonlySet<string>;
  /** A 1-on-1 chat just started from the search, shown until the list has it (an empty chat is not listed). */
  readonly started: InboxChatRowDto | null;
}

const initialState: InboxChatsState = {
  rows: [], loaded: false, loading: false, error: null, filter: 'all', kind: null, selectedIds: new Set(), favorites: new Set(), started: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

function favoritesKey(employeeId: string | null): string {
  return `${FAVORITES_KEY}.${employeeId ?? 'anonymous'}`;
}

function readFavorites(employeeId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(favoritesKey(employeeId));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
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
  withMethods((store, api = inject(InboxChatsApiService), auth = inject(AuthStore)) => {
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
            rows, loaded: true, loading: false,
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
        patchState(store, { filter, kind: null, selectedIds: new Set() });
      },
      setKind(kind: string | null): void {
        patchState(store, { kind, selectedIds: new Set() });
      },
      setSelection(selectedIds: ReadonlySet<string>): void {
        patchState(store, { selectedIds });
      },
      setStarted(started: InboxChatRowDto | null): void {
        patchState(store, { started });
      },
      loadFavorites(): void {
        patchState(store, { favorites: readFavorites(auth.employeeId() ?? null) });
      },
      toggleFavorite(conversationId: string): void {
        const next = new Set(store.favorites());
        if (next.has(conversationId)) next.delete(conversationId);
        else next.add(conversationId);
        patchState(store, { favorites: next });
        try {
          localStorage.setItem(favoritesKey(auth.employeeId() ?? null), JSON.stringify([...next]));
        } catch {
          // Storage can be unavailable (private mode); the pin still holds for this visit.
        }
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService), auth = inject(AuthStore)) => {
    let subscription: Subscription | null = null;
    return {
      onInit(): void {
        // Favorites belong to the signed-in person: reload them when that changes.
        effect(() => {
          auth.employeeId();
          untracked(() => store.loadFavorites());
        });
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
