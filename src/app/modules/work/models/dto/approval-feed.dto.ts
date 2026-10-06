import { WorkApprovalStatus } from './work-approval.dto';

export type ApprovalFeedSource = 'engine' | 'invitation';
export type ApprovalDirection = 'sent' | 'received';

/** One row of the Approvals page: an engine request or a module invitation the caller sent or received. */
export interface ApprovalFeedItemDto {
  id: string;
  source: ApprovalFeedSource;
  actionType: string;             // engine action types + 'module.invitation'
  targetType: 'task' | 'module' | 'sprint' | 'project';
  targetId: string | null;
  targetTitle: string;
  moduleId: string | null;
  moduleTitle: string | null;
  projectName: string;
  status: WorkApprovalStatus;
  direction: ApprovalDirection;
  requestedById: string;
  requestedByName: string;
  approverId: string;
  approverName: string;
  decidedById: string | null;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
  canDecide: boolean;
  canCancel: boolean;
  commentCount: number;
  summary: string | null;
}

export type ApprovalFieldKind = 'text' | 'longtext' | 'number' | 'hours' | 'date' | 'priority' | 'employee' | 'sprint';

export interface ApprovalFieldDto {
  /** The payload's own property name (PascalCase for tasks, camelCase for modules/sprints). */
  key: string;
  label: string;
  kind: ApprovalFieldKind;
  current: string | null;
  requested: string | null;
  applied: string | null;
  changed: boolean;
  editable: boolean;
}

export interface ApprovalInvitationDto {
  inviteeId: string; inviteeName: string; inviteType: string;
  invitedById: string; invitedByName: string;
  moduleId: string; moduleTitle: string; expiresAt: string | null;
}

export interface ApprovalDetailDto {
  item: ApprovalFeedItemDto;
  requestedPayloadJson: string | null;
  appliedPayloadJson: string | null;
  fields: ApprovalFieldDto[];
  canEditPayload: boolean;
  note: string | null;
  currentAllocatedHours: number | null;
  invitation: ApprovalInvitationDto | null;
  /** True only for the viewer who decided this request, only while approved/rejected, only within revertableUntil. Always false for an invitation row. */
  canRevert: boolean;
  revertableUntil: string | null;
}

export interface ApprovalCommentDto {
  id: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  content: string;
  isEdited: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export type ApprovalCommentSubjectType = 'approval' | 'invitation';
