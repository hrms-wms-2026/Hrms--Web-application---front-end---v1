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
  /** Per-action extras for the dialogs: "revertableUntil" (ISO), "outcomes" (comma list), "forwardTo", "escalateTo". */
  meta?: Record<string, string> | null;
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
  /** The choices of a "select" (or "employee") row. */
  options?: InboxFilterOptionDto[] | null;
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
  /** The payload of the kind's detail renderer (descriptor `detailRenderer`); null for the default view. */
  extraJson?: string | null;
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
  /** What needs the caller per source / per "source:kind" (the tab badges). */
  bySource?: Record<string, number> | null;
  byKind?: Record<string, number> | null;
}

/** InboxCapabilities flags (backend enum, serialized as a number). */
export const InboxCapability = {
  Chat: 1,
  EditBeforeApprove: 2,
  Revert: 4,
  Bulk: 8,
  Escalate: 16,
  Resolve: 32,
  Cancel: 64,
  Forward: 128,
  RequestInfo: 256,
  SubjectParticipates: 512
} as const;
export type InboxCapabilityFlag = (typeof InboxCapability)[keyof typeof InboxCapability];

/** One (source, kind) the inbox knows (GET /inbox/kinds). */
export interface InboxKindDescriptorDto {
  source: string;
  kind: string;
  label: string;
  category: InboxCategory;
  capabilities: number;
  detailRenderer: string | null;
}

export function hasCapability(descriptor: InboxKindDescriptorDto | null | undefined, flag: InboxCapabilityFlag): boolean {
  return !!descriptor && (descriptor.capabilities & flag) === flag;
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
  /** "resolve": excused | confirmed | convert_to_leave. */
  outcome?: string | null;
  /** "change_decision" (leave): approve | reject. */
  decision?: string | null;
  /** "cancel" (leave, partial): the first day that is given back. */
  effectiveDate?: string | null;
  /** "resolve" with convert_to_leave. */
  leaveTypeId?: string | null;
}

/** One History row: a decision the caller took. `item` is null when the caller can no longer see the item. */
export interface InboxHistoryEntryDto {
  journalId: string;
  source: string;
  kind: string;
  itemId: string;
  action: string;
  actionLabel: string;
  decidedAt: string;
  comment: string | null;
  isReverted: boolean;
  canRevert: boolean;
  revertableUntil: string | null;
  title: string;
  item: InboxItemDto | null;
}

export interface InboxHistoryPageDto {
  items: InboxHistoryEntryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InboxHistoryQuery {
  from?: string | null;
  to?: string | null;
  source?: string | null;
  kind?: string | null;
  page?: number;
  pageSize?: number;
}

/** POST /inbox/bulk: one action over many items (kinds with the Bulk capability). */
export interface InboxBulkRequestDto {
  action: string;
  items: InboxItemRef[];
  comment?: string | null;
  outcome?: string | null;
}

export interface InboxBulkResultDto {
  succeeded: InboxItemRef[];
  failed: { ref: InboxItemRef; message: string }[];
}

export interface InboxActionResultDto {
  affectedEmployeeIds: string[];
  message: string | null;
}

// ---- Conversations (api/v1/conversations) --------------------------------------------------------

export type ConversationMessageDto = RealtimeConversationMessage;
export type ConversationParticipantDto = RealtimeConversationParticipant;

/** A colleague who can be added to a conversation (GET conversations/people). */
export interface ConversationPersonDto {
  employeeId: string;
  name: string;
  avatarFileId: string | null;
}

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
  /** The employee an alert/case is about - only they may tag a justification. */
  subjectEmployeeId?: string | null;
}

export interface ConversationMessagesPageDto {
  items: ConversationMessageDto[];
  hasMore: boolean;
}

export function sameRef(a: InboxItemRef | null | undefined, b: InboxItemRef | null | undefined): boolean {
  return !!a && !!b && a.source === b.source && a.kind === b.kind && a.id === b.id;
}
