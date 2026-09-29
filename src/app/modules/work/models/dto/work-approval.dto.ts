export type WorkApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'stale';

export interface WorkApprovalRequestDto {
  id: string;
  projectId: string;
  actionType: string;          // 'task.create' | 'task.edit' | 'task.delete' | 'project.status_template_change' | ...
  targetType: 'task' | 'module' | 'sprint' | 'project';
  targetId: string | null;
  targetTitle: string;
  status: WorkApprovalStatus;
  requestedByEmployeeId: string;
  requestedByName: string;
  approverEmployeeId: string;
  approverName: string;
  payloadJson: string;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** Body of a 202 from create/edit/delete: the change was sent for approval instead of applied. */
export interface PendingApprovalDto {
  approvalRequestId: string;
}

export function isPendingApproval(value: unknown): value is PendingApprovalDto {
  return !!value && typeof value === 'object' && 'approvalRequestId' in value;
}
