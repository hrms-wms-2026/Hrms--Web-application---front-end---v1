/** Wire shapes pushed by the backend InboxHub (/hubs/inbox). Each event carries one object payload. */

export interface RealtimeItemRef {
  source: string;
  kind: string;
  id: string;
}

export interface RealtimeConversationMessage {
  id: string;
  conversationId: string;
  authorEmployeeId: string | null;
  authorName: string | null;
  authorAvatarFileId: string | null;
  /** "evidence": an empty marker where the item's evidence (an identity case's face checks) sits in the chat.
   *  "case": a request or alert posted into a people chat; systemEventJson holds its reference. */
  kind: 'text' | 'system' | 'evidence' | 'case';
  bodyHtml: string;
  systemEventJson: string | null;
  mentionEmployeeIds: string[];
  createdAt: string;
  /** null | "justification". */
  tag?: string | null;
  editedAt?: string | null;
  /** A deleted message keeps its place with an empty body ("Message deleted"). */
  isDeleted?: boolean;
  attachments?: RealtimeConversationAttachment[] | null;
  /** One reaction per person; grouped by emoji, first used first. */
  reactions?: RealtimeConversationReaction[] | null;
  /** The message this one replies to, as it is now. */
  replyTo?: RealtimeConversationReplyPreview | null;
}

/** A reply's quote: plain text, cut short; empty for a deleted message and for an evidence marker. */
export interface RealtimeConversationReplyPreview {
  id: string;
  authorEmployeeId: string | null;
  authorName: string | null;
  kind: 'text' | 'system' | 'evidence' | 'case';
  excerpt: string;
  isDeleted: boolean;
}

export interface RealtimeConversationReaction {
  emoji: string;
  employeeIds: string[];
}

export interface RealtimeConversationAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RealtimeConversationParticipant {
  employeeId: string;
  name: string;
  avatarFileId: string | null;
  /** base = the item's own people; added = brought in by a member; viewer = an escalation target (reads only). */
  joinReason: 'base' | 'added' | 'viewer';
  addedByEmployeeId: string | null;
  addedAt: string | null;
  /** Latest point this participant marked the conversation read. */
  lastReadAt?: string | null;
}

export interface MessageUpdatedEvent {
  conversationId: string;
  message: RealtimeConversationMessage;
}

export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
}

export interface MessageHiddenEvent {
  conversationId: string;
  messageId: string;
}

export interface ParticipantReadEvent {
  conversationId: string;
  employeeId: string;
  readAt: string;
}

export interface ParticipantRemovedEvent {
  conversationId: string;
  employeeId: string;
}

export interface MessageCreatedEvent {
  conversationId: string;
  message: RealtimeConversationMessage;
}

export interface ParticipantAddedEvent {
  conversationId: string;
  participant: RealtimeConversationParticipant;
}

export interface InboxChangedEvent {
  item: RealtimeItemRef;
}
