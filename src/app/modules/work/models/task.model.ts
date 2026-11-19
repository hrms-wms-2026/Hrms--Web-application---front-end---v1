export type TaskStatusCategory = 'not_started' | 'active' | 'done';

export interface TaskStatusColumn {
  id: string;
  name: string;
  displayOrder: number;
  /** Dead field, round-tripped for backward compatibility only - not consumed anywhere in this
   * app (WM-01, HRMS-Backend-v1/docs/superpowers/plans/next/2026-10-12-pre-uat-audit-wm-sec-findings.md). */
  requiresApproval: boolean;
  /** See requiresApproval - same dead-field status. */
  approverId?: string | null;
  marksTaskComplete: boolean;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
}

export interface TaskAttachment {
  fileId: string;
  name: string;
  sizeBytes: number;
}

export interface TaskAssigneeIdentity {
  employeeId: string;
  name: string;
  avatarUrl: string | null;
}

export interface WorkTask {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  categoryId: string;
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
  sprintId: string | null;
    assigneeEmployeeIds: string[];
  openClockSessionEmployeeId: string | null;
  openClockSessionClockInAt: Date | null;
  totalLoggedMinutes: number;
  attachments: TaskAttachment[];
  assignees: TaskAssigneeIdentity[];
  parentTaskId: string | null;
  subtaskTotalCount: number;
  subtaskCompletedCount: number;
  subtaskAssigneeEmployeeIds: string[];
  createdAt: Date;
  taskKind?: 'standard' | 'employee_checklist';
  visibilityScope?: 'module' | 'assignees';
  hasPendingApproval: boolean;
}
import { BulkResultSummary } from '../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';


export interface BulkTaskActionItem {
  readonly taskId: string;
  readonly outcome: 'succeeded' | 'pendingApproval' | 'failed';
  readonly reason: string | null;
}

export interface BulkTaskActionResponse {
  readonly items: readonly BulkTaskActionItem[];
  readonly succeeded: number;
  readonly failed: number;
  /** Items sent for approval instead of applied (bulk delete by a non-owner). */
  readonly pendingApproval?: number;
}

export function toBulkResultSummary(response: BulkTaskActionResponse): BulkResultSummary {
  return {
    items: response.items.map((item) => ({
      id: item.taskId,
      outcome: item.outcome,
      reason: item.reason
    })),
    succeeded: response.succeeded,
    pendingApproval: response.pendingApproval ?? 0,
    failed: response.failed
  };
}
