import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, firstValueFrom, merge } from 'rxjs';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { ConversationsApiService } from '../data-access/conversations-api.service';
import { ConversationMessageDto, ConversationParticipantDto, InboxItemRef } from '../models/inbox.dto';
import { InboxStore } from './inbox.store';

interface ConversationState {
  readonly ref: InboxItemRef | null;
  readonly conversationId: string | null;
  readonly title: string;
  readonly participants: readonly ConversationParticipantDto[];
  readonly messages: readonly ConversationMessageDto[];
  readonly hasMore: boolean;
  /** The read marker as it was when the chat was opened - drives the "unread" divider. */
  readonly openedLastReadAt: string | null;
  readonly loading: boolean;
  readonly olderLoading: boolean;
  readonly error: string | null;
  readonly sending: boolean;
  readonly sendError: string | null;
}

const initialState: ConversationState = {
  ref: null,
  conversationId: null,
  title: '',
  participants: [],
  messages: [],
  hasMore: false,
  openedLastReadAt: null,
  loading: false,
  olderLoading: false,
  error: null,
  sending: false,
  sendError: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

function byTime(a: ConversationMessageDto, b: ConversationMessageDto): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** One item's group chat. Provide it per conversation panel (not root): each panel owns its own chat. */
export const ConversationStore = signalStore(
  withState<ConversationState>(initialState),
  withComputed((store) => ({
    /** First message the user had not read when the chat opened (null = all read). */
    unreadFromId: computed(() => {
      const since = store.openedLastReadAt();
      const first = store.messages().find((m) => since === null || m.createdAt > since);
      return first?.id ?? null;
    }),
    participantIds: computed(() => store.participants().map((p) => p.employeeId))
  })),
  withMethods((store, api = inject(ConversationsApiService), inbox = inject(InboxStore)) => {
    let openRequest = 0;

    function appendMessages(incoming: readonly ConversationMessageDto[]): void {
      const known = new Set(store.messages().map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length) patchState(store, { messages: [...store.messages(), ...fresh].sort(byTime) });
    }

    function addParticipantRows(incoming: readonly ConversationParticipantDto[]): void {
      const known = new Set(store.participantIds());
      const fresh = incoming.filter((p) => !known.has(p.employeeId));
      if (fresh.length) patchState(store, { participants: [...store.participants(), ...fresh] });
    }

    async function markRead(): Promise<void> {
      const id = store.conversationId();
      if (!id) return;
      try {
        await firstValueFrom(api.markRead(id));
      } catch {
        // Read state is best-effort; the next open marks it again.
        return;
      }
      // The rail badge counts unread messages.
      void inbox.loadCounts();
    }

    async function open(ref: InboxItemRef): Promise<void> {
      const request = ++openRequest;
      const sameItem = store.ref()?.source === ref.source && store.ref()?.kind === ref.kind && store.ref()?.id === ref.id;
      patchState(store, sameItem ? { ref, loading: true, error: null } : { ...initialState, ref, loading: true });
      try {
        const conversation = await firstValueFrom(api.open(ref));
        if (request !== openRequest) return;
        patchState(store, {
          conversationId: conversation.id,
          title: conversation.title,
          participants: conversation.participants,
          messages: [...conversation.messages].sort(byTime),
          hasMore: conversation.hasMoreMessages,
          openedLastReadAt: sameItem ? store.openedLastReadAt() : conversation.lastReadAt,
          loading: false
        });
        await markRead();
      } catch (err) {
        if (request === openRequest) patchState(store, { loading: false, error: extractError(err, 'Could not open the conversation.') });
      }
    }

    return {
      open,
      markRead,
      appendMessages,
      addParticipantRows,
      async loadOlder(): Promise<void> {
        const id = store.conversationId();
        const oldest = store.messages()[0];
        if (!id || !oldest || !store.hasMore() || store.olderLoading()) return;
        patchState(store, { olderLoading: true });
        try {
          const page = await firstValueFrom(api.messages(id, oldest.createdAt));
          appendMessages(page.items);
          patchState(store, { hasMore: page.hasMore, olderLoading: false });
        } catch {
          patchState(store, { olderLoading: false });
        }
      },
      /** True when posted. Mentions must be participant ids (add-and-tag adds them first). */
      async send(bodyHtml: string, mentionEmployeeIds: readonly string[]): Promise<boolean> {
        const id = store.conversationId();
        if (!id) return false;
        patchState(store, { sending: true, sendError: null });
        try {
          const message = await firstValueFrom(api.post(id, bodyHtml, [...mentionEmployeeIds]));
          appendMessages([message]);
          patchState(store, { sending: false });
          return true;
        } catch (err) {
          patchState(store, { sending: false, sendError: extractError(err, 'Could not send the message.') });
          return false;
        }
      },
      async addParticipants(employeeIds: readonly string[]): Promise<ConversationParticipantDto[]> {
        const id = store.conversationId();
        if (!id || employeeIds.length === 0) return [];
        try {
          const addedRows = await firstValueFrom(api.addParticipants(id, [...employeeIds]));
          addParticipantRows(addedRows);
          return addedRows;
        } catch (err) {
          patchState(store, { sendError: extractError(err, 'Could not add them to the conversation.') });
          return [];
        }
      },
      close(): void {
        openRequest++;
        patchState(store, initialState);
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService)) => {
    let subscription: Subscription | null = null;
    return {
      onInit(): void {
        subscription = new Subscription();
        subscription.add(realtime.messageCreated$.subscribe((event) => {
          if (event.conversationId !== store.conversationId()) return;
          const before = store.messages().length;
          store.appendMessages([event.message]);
          if (store.messages().length > before) void store.markRead();
        }));
        subscription.add(realtime.participantAdded$.subscribe((event) => {
          if (event.conversationId === store.conversationId()) store.addParticipantRows([event.participant]);
        }));
        subscription.add(merge(realtime.reconnected$).subscribe(() => {
          const ref = store.ref();
          if (ref && store.conversationId()) void store.open(ref);
        }));
      },
      onDestroy(): void {
        subscription?.unsubscribe();
      }
    };
  })
);
