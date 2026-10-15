import { computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { TrayPresenceStore } from '../../../core/tray-presence/state/tray-presence.store';
import { tenantWorkspaceReady } from '../../../core/tray-presence/utils/tenant-workspace-ready';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, debounceTime, firstValueFrom, map, merge } from 'rxjs';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { InboxApiService } from '../data-access/inbox-api.service';
import {
  InboxActionBody,
  InboxCountsDto,
  InboxFilterFieldDto,
  InboxItemDetailDto,
  InboxItemDto,
  InboxItemRef,
  InboxQuery,
  sameRef
} from '../models/inbox.dto';

export const INBOX_PAGE_SIZE = 25;
const REALTIME_DEBOUNCE_MS = 500;

interface InboxState {
  readonly items: readonly InboxItemDto[];
  readonly total: number;
  readonly query: InboxQuery;
  /** The list has been requested at least once (the Inbox page was opened). */
  readonly listLoaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly filterFields: readonly InboxFilterFieldDto[];
  readonly counts: InboxCountsDto;
  readonly selectedRef: InboxItemRef | null;
  readonly detail: InboxItemDetailDto | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  /** An action is in flight. */
  readonly busy: boolean;
  readonly actionError: string | null;
  /** actionError is a 422 validation message about the edited values (shown above the edit form). */
  readonly actionErrorInline: boolean;
}

const initialState: InboxState = {
  items: [],
  total: 0,
  query: { page: 1, pageSize: INBOX_PAGE_SIZE },
  listLoaded: false,
  loading: false,
  error: null,
  filterFields: [],
  counts: { pendingReceived: 0, unreadMessages: 0, openAlerts: 0 },
  selectedRef: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  busy: false,
  actionError: null,
  actionErrorInline: false
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

/** The user's Inbox across modules (requests + alerts), its filters, the selected item and the rail badge.
 *  Live: refreshes (debounced) whenever the hub reports a change to one of the user's items. */
export const InboxStore = signalStore(
  { providedIn: 'root' },
  withState<InboxState>(initialState),
  withComputed((store) => ({
    /** Rail badge: requests waiting on the user + unread chat messages. */
    badgeCount: computed(() => store.counts().pendingReceived + store.counts().unreadMessages),
    badgeLabel: computed(() => {
      const n = store.counts().pendingReceived + store.counts().unreadMessages;
      return n <= 0 ? '' : n > 9 ? '9+' : String(n);
    }),
    selected: computed(() => store.items().find((i) => sameRef(i, store.selectedRef())) ?? store.detail()?.item ?? null)
  })),
  withMethods((store, api = inject(InboxApiService)) => {
    let detailRequest = 0;

    async function load(): Promise<void> {
      patchState(store, { loading: true, error: null, listLoaded: true });
      try {
        const page = await firstValueFrom(api.list(store.query()));
        patchState(store, { items: page.items, total: page.total, loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: extractError(err, 'Could not load your inbox.') });
      }
    }

    async function loadCounts(): Promise<void> {
      try {
        patchState(store, { counts: await firstValueFrom(api.counts()) });
      } catch {
        // The badge keeps its last value; the next change event retries.
      }
    }

    async function loadDetail(ref: InboxItemRef, quiet = false): Promise<void> {
      const request = ++detailRequest;
      if (!quiet) patchState(store, { detailLoading: true, detailError: null });
      try {
        const detail = await firstValueFrom(api.detail(ref));
        if (request === detailRequest) patchState(store, { detail, detailLoading: false });
      } catch (err) {
        if (request === detailRequest)
          patchState(store, { detailLoading: false, detailError: extractError(err, 'Could not load this item.') });
      }
    }

    async function refresh(): Promise<void> {
      const tasks: Promise<void>[] = [loadCounts()];
      if (store.listLoaded()) tasks.push(load());
      const selected = store.selectedRef();
      if (selected) tasks.push(loadDetail(selected, true));
      await Promise.all(tasks);
    }

    return {
      load,
      loadCounts,
      refresh,
      async loadFilters(): Promise<void> {
        try {
          patchState(store, { filterFields: await firstValueFrom(api.filters()) });
        } catch {
          patchState(store, { filterFields: [] });
        }
      },
      async applyFilter(patch: Partial<InboxQuery>): Promise<void> {
        patchState(store, { query: { ...store.query(), ...patch, page: 1 } });
        await load();
      },
      async setPage(page: number): Promise<void> {
        patchState(store, { query: { ...store.query(), page } });
        await load();
      },
      async select(ref: InboxItemRef | null): Promise<void> {
        patchState(store, { selectedRef: ref, actionError: null, actionErrorInline: false });
        if (!ref) {
          detailRequest++;
          patchState(store, { detail: null, detailLoading: false, detailError: null });
          return;
        }
        if (!sameRef(store.detail()?.item, ref)) patchState(store, { detail: null });
        await loadDetail(ref);
      },
      /** Runs an item action; true on success. On failure the message stays in actionError. */
      async runAction(ref: InboxItemRef, action: string, body: InboxActionBody = {}): Promise<boolean> {
        patchState(store, { busy: true, actionError: null, actionErrorInline: false });
        try {
          await firstValueFrom(api.runAction(ref, action, body));
          patchState(store, { busy: false });
          await refresh();
          return true;
        } catch (err) {
          patchState(store, { busy: false, actionError: extractError(err, 'The action failed.'), actionErrorInline: (err as { status?: number })?.status === 422 });
          return false;
        }
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService), auth = inject(AuthStore),
    permissions = inject(PermissionService), tray = inject(TrayPresenceStore)) => {
    const subscription = new Subscription();
    return {
      onInit(): void {
        // The rail badge needs counts as soon as the workspace is usable, before the Inbox is opened.
        effect(() => {
          if (tenantWorkspaceReady(auth, permissions, tray)) untracked(() => void store.loadCounts());
        });
        subscription.add(merge(realtime.inboxChanged$.pipe(map(() => undefined)), realtime.reconnected$)
          .pipe(debounceTime(REALTIME_DEBOUNCE_MS))
          .subscribe(() => void store.refresh()));
        // A chat message only changes the unread count, not the list.
        subscription.add(realtime.messageCreated$
          .pipe(debounceTime(REALTIME_DEBOUNCE_MS))
          .subscribe(() => void store.loadCounts()));
      },
      onDestroy(): void {
        subscription.unsubscribe();
      }
    };
  })
);
