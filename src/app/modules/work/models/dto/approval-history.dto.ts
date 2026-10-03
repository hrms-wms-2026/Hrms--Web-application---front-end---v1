/** Kinds the legacy approval-history endpoint returns (task requests now come from wm_approval_requests). */
export type ApprovalHistoryKind =
  | 'task_creation'
  | 'task_edit'
  | 'task_delete'
  | 'task_status_change'
  | 'allocation_extend'
  | 'objective_change'
  | 'objective_edit'
  | 'objective_invitation';

export type ApprovalHistoryDirection = 'sent' | 'received';

export interface ApprovalHistoryItemDto {
  id: string;
  objectiveId: string;
  kind: ApprovalHistoryKind;
  status: 'pending' | 'approved' | 'rejected' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'stale';
  direction: ApprovalHistoryDirection;
  subjectTitle: string;
  detail: string | null;
  requestedById: string;
  requestedByName: string;
  approverId: string;
  approverName: string;
  decidedById: string | null;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}
