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
  authorAvatarUrl: string | null;
  kind: 'text' | 'system';
  bodyHtml: string;
  systemEventJson: string | null;
  mentionEmployeeIds: string[];
  createdAt: string;
}

export interface RealtimeConversationParticipant {
  employeeId: string;
  name: string;
  avatarUrl: string | null;
  joinReason: 'base' | 'added';
  addedByEmployeeId: string | null;
  addedAt: string;
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
