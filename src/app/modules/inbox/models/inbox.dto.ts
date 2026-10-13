import {
  RealtimeConversationMessage,
  RealtimeConversationParticipant,
  RealtimeItemRef
} from '../../../core/realtime/inbox-realtime.models';

/** Mirrors the backend Features/Inbox contracts (api/v1/inbox). */

export type InboxCategory = 'request' | 'alert';
export type InboxDirection = 'received' | 'sent' | 'info';
export type InboxStepState = 'done' | 'current' | 'upcoming';
export type InboxActionTone = 'primary' | 'danger' | 'neutral';

export type InboxItemRef = RealtimeItemRef;

export interface InboxPersonDto {
  id: string;
  name: string;
}

export interface InboxActionDto {
  key: string;
  label: string;
  tone: InboxActionTone;
  needsComment: boolean;
  needsPayload: boolean;
}

export interface InboxItemDto {
  source: string;
  kind: string;
  id: string;
  category: InboxCategory;
  actionType: string;
  title: string;
  subtitle: string | null;
  status: string;
  direction: InboxDirection;
  severity: string | null;
  contextType: string;
  contextId: string | null;
  contextName: string | null;
  requestedBy: InboxPersonDto | null;
  requestedTo: InboxPersonDto | null;
  createdAt: string;
  updatedAt: string;
  availableActions: InboxActionDto[];
  unreadMessages: number;
  isPending: boolean;
  facets: Record<string, string[]>;
}

export interface InboxStepDto {
  key: string;
  label: string;
  actor: InboxPersonDto | null;
  at: string | null;
  state: InboxStepState;
  note: string | null;
}

export interface InboxChangeDto {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  kind: string;
  editable: boolean;
  applied: string | null;
}

export interface InboxTargetDto {
  route: string[];
  label: string;
  queryParams: Record<string, string> | null;
}

export interface InboxItemDetailDto {
  item: InboxItemDto;
  steps: InboxStepDto[];
  summary: string | null;
  changeSet: InboxChangeDto[];
  explanation: string | null;
  explanationDetails: Record<string, string> | null;
  target: InboxTargetDto | null;
  editablePayloadJson: string | null;
}

export interface InboxFilterOptionDto {
  value: string;
  label: string;
}

export interface InboxFilterFieldDto {
  key: string;
  label: string;
  multi: boolean;
  options: InboxFilterOptionDto[];
}

export interface InboxPageDto {
  items: InboxItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InboxCountsDto {
  pendingReceived: number;
  unreadMessages: number;
  openAlerts: number;
}

/** Query-string filters of GET /inbox. `facets` are source-specific ("module" → ids). */
export interface InboxQuery {
  category?: InboxCategory[];
  source?: string[];
  project?: string[];
  status?: string[];
  direction?: InboxDirection[];
  type?: string[];
  requestedBy?: string[];
  from?: string | null;
  to?: string | null;
  search?: string | null;
  facets?: Record<string, string[]>;
  page?: number;
  pageSize?: number;
}

export interface InboxActionBody {
  comment?: string | null;
  editedPayloadJson?: string | null;
}

export interface InboxActionResultDto {
  affectedEmployeeIds: string[];
  message: string | null;
}

// ---- Conversations (api/v1/conversations) --------------------------------------------------------

export type ConversationMessageDto = RealtimeConversationMessage;
export type ConversationParticipantDto = RealtimeConversationParticipant;

export interface ConversationDto {
  id: string;
  source: string;
  kind: string;
  subjectId: string;
  title: string;
  projectId: string | null;
  participants: ConversationParticipantDto[];
  messages: ConversationMessageDto[];
  hasMoreMessages: boolean;
  lastReadAt: string | null;
}

export interface ConversationMessagesPageDto {
  items: ConversationMessageDto[];
  hasMore: boolean;
}

export function sameRef(a: InboxItemRef | null | undefined, b: InboxItemRef | null | undefined): boolean {
  return !!a && !!b && a.source === b.source && a.kind === b.kind && a.id === b.id;
}
