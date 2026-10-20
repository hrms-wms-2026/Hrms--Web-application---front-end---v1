import { InboxItemRef } from './inbox.dto';

/** "direct": a 1-on-1 chat; "group": a named group; "case": the dedicated group of one request or alert. */
export type InboxChatType = 'direct' | 'group' | 'case';

/** A pending item in a chat the caller can act on (the Pending filter, bulk approval). */
export interface InboxChatPendingItemDto {
  source: string;
  kind: string;
  id: string;
  title: string;
}

/** One row of GET /inbox/chats. `source`/`kind`/`subjectId` open the chat (POST /conversations/open). */
export interface InboxChatRowDto {
  conversationId: string;
  source: string;
  kind: string;
  subjectId: string;
  type: InboxChatType;
  title: string;
  /** 1-on-1 chats: the other person. */
  otherEmployeeId: string | null;
  avatarFileId: string | null;
  memberCount: number;
  preview: string | null;
  lastMessageAt: string | null;
  unread: number;
  pending: InboxChatPendingItemDto[];
  /** Case groups: their request or alert. */
  caseItem: InboxChatPendingItemDto | null;
}

/** Where a chat opens. */
export interface InboxChatRefDto {
  conversationId: string;
  source: string;
  kind: string;
  subjectId: string;
}

/** The subject a chat is opened by (the conversation store's ref). */
export function chatRef(row: { source: string; kind: string; subjectId: string }): InboxItemRef {
  return { source: row.source, kind: row.kind, id: row.subjectId };
}

/** People chats are addressed by these sources; any other source is a module's request or alert. */
export function isPeopleChatSource(source: string): boolean {
  return source === 'direct' || source === 'group';
}

/** The event payload of a system line (case resolved, continued in a group, ...); null when it has none. */
export interface ChatSystemEvent {
  type: string;
  source?: string;
  kind?: string;
  id?: string;
  title?: string;
  status?: string;
  category?: string;
  conversationId?: string;
}

export function parseSystemEvent(json: string | null | undefined): ChatSystemEvent | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as ChatSystemEvent;
    return value && typeof value.type === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** The item a case card message carries. */
export function caseRefOf(json: string | null | undefined): (InboxItemRef & { title: string }) | null {
  const event = parseSystemEvent(json);
  return event?.type === 'case' && event.source && event.kind && event.id
    ? { source: event.source, kind: event.kind, id: event.id, title: event.title ?? '' }
    : null;
}
