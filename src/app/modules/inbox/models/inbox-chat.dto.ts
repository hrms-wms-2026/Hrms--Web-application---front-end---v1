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
  /** The caller pinned it to the top of its section. */
  isFavorite?: boolean;
  /** The caller muted it: its unread messages leave their inbox badge. */
  isMuted?: boolean;
  /** Groups and case groups: their description (plain text). */
  description?: string | null;
}

/** What a chat's files are grouped by in its info panel. */
export type ChatMediaKind = 'image' | 'video' | 'audio' | 'document';

/** One file posted in a chat (GET /inbox/chats/:id/media). */
export interface ChatMediaItemDto {
  id: string;
  messageId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: ChatMediaKind;
  sentAt: string;
  authorEmployeeId: string | null;
  authorName: string | null;
}

export interface ChatMediaPageDto {
  items: ChatMediaItemDto[];
  /** Files of the requested kind (all files when no kind was asked for). */
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<ChatMediaKind, number>>;
}

/** A text message that matched the chat search. */
export interface ChatSearchResultDto {
  messageId: string;
  sentAt: string;
  authorEmployeeId: string | null;
  authorName: string | null;
  snippet: string;
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
  /** A case card someone forwarded into this chat (a copy; the case is worked on where it was placed). */
  forwarded?: boolean;
  /** case_resolved: the item's type ("Annual Leave"), who decided it, the alert outcome and the decision's note. */
  what?: string;
  byName?: string | null;
  outcome?: string | null;
  comment?: string | null;
  /** case_resolved: the item's one-line summary ("Sick Leave · 15 Sep – 15 Sep · 8 h"). */
  summary?: string | null;
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
export function caseRefOf(json: string | null | undefined): (InboxItemRef & { title: string; forwarded: boolean }) | null {
  const event = parseSystemEvent(json);
  return event?.type === 'case' && event.source && event.kind && event.id
    ? { source: event.source, kind: event.kind, id: event.id, title: event.title ?? '', forwarded: event.forwarded === true }
    : null;
}
