import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Subscription, firstValueFrom, merge } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
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
  /** The employee an alert/case is about (may tag a justification). */
  readonly subjectEmployeeId: string | null;
  /** The caller was removed from (or left) this conversation: the panel stops sending. */
  readonly removed: boolean;
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
  subjectEmployeeId: null,
  removed: false,
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

/** A deleted message keeps its place as a "Message deleted" placeholder. */
function asDeleted(message: ConversationMessageDto): ConversationMessageDto {
  return { ...message, isDeleted: true, bodyHtml: '', attachments: [], mentionEmployeeIds: [] };
}

/** One item's group chat. Provide it per conversation panel (not root): each panel owns its own chat. */
export const ConversationStore = signalStore(
  withState<ConversationState>(initialState),
  withComputed((store) => ({
    /** First message the user had not read when the chat opened (null = all read). */
    unreadFromId: computed(() => {
      const since = store.openedLastReadAt();
      // The evidence card is not a message anyone sent: it never counts as unread.
      const first = store.messages().find((m) => m.kind !== 'evidence' && (since === null || m.createdAt > since));
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

    function replaceMessage(message: ConversationMessageDto): void {
      if (store.messages().some((m) => m.id === message.id))
        patchState(store, { messages: store.messages().map((m) => (m.id === message.id ? message : m)) });
    }

    function markDeleted(messageId: string): void {
      patchState(store, { messages: store.messages().map((m) => (m.id === messageId ? asDeleted(m) : m)) });
    }

    function addParticipantRows(incoming: readonly ConversationParticipantDto[]): void {
      const known = new Set(store.participantIds());
      const fresh = incoming.filter((p) => !known.has(p.employeeId));
      if (fresh.length) patchState(store, { participants: [...store.participants(), ...fresh] });
    }

    function dropParticipant(employeeId: string): void {
      patchState(store, { participants: store.participants().filter((p) => p.employeeId !== employeeId) });
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
          subjectEmployeeId: conversation.subjectEmployeeId ?? null,
          removed: false,
          loading: false
        });
        await markRead();
      } catch (err) {
        if (request === openRequest) patchState(store, { loading: false, error: extractError(err, 'Could not open the conversation.') });
      }
    }

    /** Runs a call against the open conversation; false (with sendError) when it fails. */
    async function run(call: (conversationId: string) => Promise<void>, fallback: string): Promise<boolean> {
      const id = store.conversationId();
      if (!id) return false;
      patchState(store, { sendError: null });
      try {
        await call(id);
        return true;
      } catch (err) {
        patchState(store, { sendError: extractError(err, fallback) });
        return false;
      }
    }

    return {
      open,
      markRead,
      appendMessages,
      replaceMessage,
      markDeleted,
      addParticipantRows,
      dropParticipant,
      async loadOlder(): Promise<void> {
        const id = store.conversationId();
        const oldest = store.messages()[0];
        if (!id || !oldest || !store.hasMore() || store.olderLoading()) return;
        patchState(store, { olderLoading: true });
        try {
          const page = await firstValueFrom(api.messages(id, oldest.createdAt));
          // Another ticket may have been opened meanwhile: its conversation must not get these messages.
          if (store.conversationId() !== id) return;
          appendMessages(page.items);
          patchState(store, { hasMore: page.hasMore, olderLoading: false });
        } catch {
          if (store.conversationId() === id) patchState(store, { olderLoading: false });
        }
      },
      /** True when posted. Mentions must be participant ids (add-and-tag adds them first). */
      async send(
        bodyHtml: string, mentionEmployeeIds: readonly string[], attachmentFileIds: readonly string[] = [], tag: string | null = null,
        replyToMessageId: string | null = null
      ): Promise<boolean> {
        const id = store.conversationId();
        if (!id || store.removed()) return false;
        patchState(store, { sending: true, sendError: null });
        try {
          const message = await firstValueFrom(api.post(id, bodyHtml, [...mentionEmployeeIds], [...attachmentFileIds], tag, replyToMessageId));
          // Posted to its own ticket; only shown if that ticket is still the open one.
          if (store.conversationId() === id) {
            appendMessages([message]);
            patchState(store, { sending: false });
          }
          return true;
        } catch (err) {
          if (store.conversationId() === id) patchState(store, { sending: false, sendError: extractError(err, 'Could not send the message.') });
          return false;
        }
      },
      editMessage(messageId: string, bodyHtml: string, mentionEmployeeIds: readonly string[]): Promise<boolean> {
        return run(async (id) => replaceMessage(await firstValueFrom(api.edit(id, messageId, bodyHtml, [...mentionEmployeeIds]))),
          'Could not edit the message.');
      },
      /** Sets (or, with null, removes) the caller's one reaction on a message. */
      react(messageId: string, emoji: string | null): Promise<boolean> {
        return run(async (id) => replaceMessage(await firstValueFrom(emoji
          ? api.react(id, messageId, emoji)
          : api.unreact(id, messageId))), 'Could not react to the message.');
      },
      deleteMessage(messageId: string): Promise<boolean> {
        return run(async (id) => {
          await firstValueFrom(api.deleteMessage(id, messageId));
          markDeleted(messageId);
        }, 'Could not delete the message.');
      },
      removeParticipant(employeeId: string): Promise<boolean> {
        return run(async (id) => {
          await firstValueFrom(api.removeParticipant(id, employeeId));
          dropParticipant(employeeId);
        }, 'Could not remove them from the conversation.');
      },
      /** The caller (an added member) leaves; the panel then stops sending. */
      leave(): Promise<boolean> {
        return run(async (id) => {
          await firstValueFrom(api.leave(id));
          patchState(store, { removed: true });
        }, 'Could not leave the conversation.');
      },
      markSendError(message: string): void {
        patchState(store, { sendError: message });
      },
      setRemoved(): void {
        patchState(store, { removed: true });
      },
      async addParticipants(employeeIds: readonly string[]): Promise<ConversationParticipantDto[]> {
        const id = store.conversationId();
        if (!id || employeeIds.length === 0) return [];
        try {
          const addedRows = await firstValueFrom(api.addParticipants(id, [...employeeIds]));
          if (store.conversationId() === id) addParticipantRows(addedRows);
          return addedRows;
        } catch (err) {
          if (store.conversationId() === id) patchState(store, { sendError: extractError(err, 'Could not add them to the conversation.') });
          return [];
        }
      },
      close(): void {
        openRequest++;
        patchState(store, initialState);
      }
    };
  }),
  withHooks((store, realtime = inject(InboxRealtimeService), auth = inject(AuthStore, { optional: true })) => {
    let subscription: Subscription | null = null;
    const mine = (conversationId: string) => !!conversationId && conversationId === store.conversationId();
    return {
      onInit(): void {
        subscription = new Subscription();
        subscription.add(realtime.messageCreated$.subscribe((event) => {
          if (!mine(event.conversationId)) return;
          const before = store.messages().length;
          store.appendMessages([event.message]);
          if (store.messages().length > before) void store.markRead();
        }));
        subscription.add(realtime.participantAdded$.subscribe((event) => {
          if (mine(event.conversationId)) store.addParticipantRows([event.participant]);
        }));
        subscription.add(realtime.messageUpdated$.subscribe((event) => {
          if (mine(event.conversationId)) store.replaceMessage(event.message);
        }));
        subscription.add(realtime.messageDeleted$.subscribe((event) => {
          if (mine(event.conversationId)) store.markDeleted(event.messageId);
        }));
        subscription.add(realtime.participantRemoved$.subscribe((event) => {
          if (!mine(event.conversationId)) return;
          store.dropParticipant(event.employeeId);
          if (event.employeeId === auth?.employeeId?.()) store.setRemoved();
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
