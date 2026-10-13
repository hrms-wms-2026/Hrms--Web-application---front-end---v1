import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InboxRealtimeService } from '../../../core/realtime/inbox-realtime.service';
import { MessageCreatedEvent, ParticipantAddedEvent } from '../../../core/realtime/inbox-realtime.models';
import { ConversationsApiService } from '../data-access/conversations-api.service';
import { ConversationDto, ConversationMessageDto, ConversationParticipantDto } from '../models/inbox.dto';
import { ConversationStore } from './conversation.store';
import { InboxStore } from './inbox.store';

const REF = { source: 'work', kind: 'approval', id: 'a1' };

function message(id: string, createdAt: string, extra: Partial<ConversationMessageDto> = {}): ConversationMessageDto {
  return {
    id, conversationId: 'c1', authorEmployeeId: 'e1', authorName: 'Bala', authorAvatarFileId: null, kind: 'text',
    bodyHtml: `<p>${id}</p>`, systemEventJson: null, mentionEmployeeIds: [], createdAt, ...extra
  };
}

function participant(employeeId: string, joinReason: 'base' | 'added' = 'base'): ConversationParticipantDto {
  return { employeeId, name: employeeId, avatarFileId: null, joinReason, addedByEmployeeId: null, addedAt: null };
}

function conversation(extra: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: 'c1', source: 'work', kind: 'approval', subjectId: 'a1', title: 'Task edit: Audit', projectId: 'p1',
    participants: [participant('e1'), participant('e2')],
    messages: [message('m2', '2026-10-13T09:02:00Z'), message('m3', '2026-10-13T09:03:00Z')],
    hasMoreMessages: true, lastReadAt: '2026-10-13T09:02:30Z', ...extra
  };
}

describe('ConversationStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let created: Subject<MessageCreatedEvent>;
  let added: Subject<ParticipantAddedEvent>;
  let reconnected: Subject<void>;
  let store: InstanceType<typeof ConversationStore>;
  let inbox: { loadCounts: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      open: vi.fn(() => of(conversation())),
      messages: vi.fn(() => of({ items: [message('m1', '2026-10-13T09:01:00Z')], hasMore: false })),
      post: vi.fn((_: string, html: string) => of(message('m9', '2026-10-13T09:09:00Z', { bodyHtml: html }))),
      addParticipants: vi.fn((_: string, ids: string[]) => of(ids.map((id) => participant(id, 'added')))),
      markRead: vi.fn(() => of(undefined))
    };
    created = new Subject();
    added = new Subject();
    reconnected = new Subject();
    inbox = { loadCounts: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({
      providers: [
        ConversationStore,
        { provide: InboxStore, useValue: inbox },
        { provide: ConversationsApiService, useValue: api },
        {
          provide: InboxRealtimeService,
          useValue: { messageCreated$: created.asObservable(), participantAdded$: added.asObservable(), reconnected$: reconnected.asObservable() }
        }
      ]
    });
    store = TestBed.inject(ConversationStore);
  });

  it('opens the item conversation, keeps the read marker it had and marks it read', async () => {
    await store.open(REF);

    expect(api['open']).toHaveBeenCalledWith(REF);
    expect(store.conversationId()).toBe('c1');
    expect(store.messages().map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(store.participants().map((p) => p.employeeId)).toEqual(['e1', 'e2']);
    expect(store.hasMore()).toBe(true);
    expect(store.unreadFromId()).toBe('m3');
    expect(api['markRead']).toHaveBeenCalledWith('c1');
  });

  it('refreshes the inbox counts once the conversation is marked read, but not when that fails', async () => {
    await store.open(REF);
    expect(inbox.loadCounts).toHaveBeenCalledTimes(1);

    api['markRead'].mockReturnValue(throwError(() => new Error('offline')));
    await store.markRead();
    expect(inbox.loadCounts).toHaveBeenCalledTimes(1);
  });

  it('surfaces an open error', async () => {
    api['open'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'Conversation not found.' } })));
    await store.open(REF);
    expect(store.error()).toBe('Conversation not found.');
  });

  it('loadOlder prepends the page before the oldest message', async () => {
    await store.open(REF);
    await store.loadOlder();

    expect(api['messages']).toHaveBeenCalledWith('c1', '2026-10-13T09:02:00Z');
    expect(store.messages().map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(store.hasMore()).toBe(false);
  });

  it('send posts with mentions and appends the message once, even if the hub echoes it', async () => {
    await store.open(REF);

    const ok = await store.send('<p>hi</p>', ['e2']);
    created.next({ conversationId: 'c1', message: message('m9', '2026-10-13T09:09:00Z') });

    expect(ok).toBe(true);
    expect(api['post']).toHaveBeenCalledWith('c1', '<p>hi</p>', ['e2']);
    expect(store.messages().filter((m) => m.id === 'm9')).toHaveLength(1);
  });

  it('a failed send keeps the error and returns false', async () => {
    await store.open(REF);
    api['post'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'You can only mention people in this conversation.' } })));

    expect(await store.send('<p>x</p>', ['zz'])).toBe(false);
    expect(store.sendError()).toBe('You can only mention people in this conversation.');
  });

  it('appends live messages of this conversation only and marks them read', async () => {
    await store.open(REF);
    api['markRead'].mockClear();

    created.next({ conversationId: 'other', message: message('x1', '2026-10-13T09:05:00Z', { conversationId: 'other' }) });
    created.next({ conversationId: 'c1', message: message('m4', '2026-10-13T09:04:00Z', { authorEmployeeId: 'e2' }) });

    expect(store.messages().map((m) => m.id)).toEqual(['m2', 'm3', 'm4']);
    expect(api['markRead']).toHaveBeenCalledTimes(1);
  });

  it('addParticipants adds the new members; live participant events are de-duplicated', async () => {
    await store.open(REF);

    const result = await store.addParticipants(['e3']);
    added.next({ conversationId: 'c1', participant: participant('e3', 'added') });
    added.next({ conversationId: 'c1', participant: participant('e4', 'added') });

    expect(result.map((p) => p.employeeId)).toEqual(['e3']);
    expect(store.participants().map((p) => p.employeeId)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('reloads after a reconnect and stops listening once closed', async () => {
    await store.open(REF);
    api['open'].mockClear();

    reconnected.next();
    await Promise.resolve();
    expect(api['open']).toHaveBeenCalledTimes(1);

    store.close();
    created.next({ conversationId: 'c1', message: message('m5', '2026-10-13T09:05:00Z') });
    expect(store.messages()).toEqual([]);
    expect(store.conversationId()).toBeNull();
  });
});
