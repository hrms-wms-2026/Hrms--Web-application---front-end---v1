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
  kind: 'text' | 'system';
  bodyHtml: string;
  systemEventJson: string | null;
  mentionEmployeeIds: string[];
  createdAt: string;
  /** null | "info_request" | "info_response" | "justification". */
  tag?: string | null;
  editedAt?: string | null;
  /** A deleted message keeps its place with an empty body ("Message deleted"). */
  isDeleted?: boolean;
  attachments?: RealtimeConversationAttachment[] | null;
  /** One reaction per person; grouped by emoji, first used first. */
  reactions?: RealtimeConversationReaction[] | null;
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
}

export interface MessageUpdatedEvent {
  conversationId: string;
  message: RealtimeConversationMessage;
}

export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
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
