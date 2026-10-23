import { TaskStatusCategory } from '../task.model';

export interface TaskStatusDto {
  id: string;
  name: string;
  displayOrder: number;
  /** Dead field, round-tripped for backward compatibility only - not consumed anywhere in this
   * app (WM-01, HRMS-Backend-v1/docs/superpowers/plans/next/2026-10-12-pre-uat-audit-wm-sec-findings.md). */
  requiresApproval: boolean;
  /** See requiresApproval - same dead-field status. */
  approverId: string | null;
  marksTaskComplete: boolean;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
}

export interface TaskAttachmentDto {
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
}

export interface TaskAssigneeIdentityDto {
  employeeId: string;
  name: string;
  avatarFileId?: string | null;
  /** Temporary compatibility fallback for older API deployments. */
  avatarUrl?: string | null;
}

export interface PendingUploadDto {
  fileId: string;
  originalFileName: string;
  fileSizeBytes: number;
  contentType: string;
}

export interface WorkTaskDto {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  categoryId: string;
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: string | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
  sprintId: string | null;
    assigneeEmployeeIds: string[];
  openClockSessionEmployeeId: string | null;
  openClockSessionClockInAt: string | null;
  totalLoggedMinutes: number;
  activeEventId?: string | null;
  activeEventName?: string | null;
  attachments?: TaskAttachmentDto[];
  assignees?: TaskAssigneeIdentityDto[];
  parentTaskId?: string | null;
  subtaskTotalCount?: number;
  subtaskCompletedCount?: number;
  subtaskAssigneeEmployeeIds?: string[];
  createdAt: string;
  taskKind?: 'standard' | 'employee_checklist';
  visibilityScope?: 'module' | 'assignees';
  hasPendingApproval?: boolean;
}

export interface CreateTaskRequestDto {
  title: string;
  description?: string;
  categoryId: string;
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  sprintId: string | null;
  attachmentFileIds?: string[];
  /** An action item: the meeting occurrence (task id) it was raised from. Left out for every ordinary task. */
  sourceMeetingOccurrenceId?: string;
}

export interface CreateSubtaskRequestDto {
  title: string;
  priority?: WorkTaskDto['priority'];
  dueDate?: string;
  assigneeEmployeeId?: string;
  objectiveId?: string;
  categoryId?: string;
}

export interface EditTaskRequestDto {
  title: string;
  description?: string;
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  progressPercent?: number;
  reason?: string;
  sprintId?: string | null;
  attachmentFileIds?: string[];
  categoryId?: string;
  objectiveId?: string;
}

export interface DuplicateTaskRequestDto {
  destinationObjectiveId: string;
  title: string;
  copyAttachments: boolean;
  copyAssignees: boolean;
  copyComments: boolean;
  copyDueDate: boolean;
}

export interface ConvertTaskToSubtaskRequestDto {
  newParentTaskId: string;
}

export interface PushTaskRequestDto {
  percent: number;
  reason?: string;
}

export interface AddReasonRequestDto {
  reason: string;
}

/** Shape of a 409 INSUFFICIENT_OBJECTIVE_ALLOCATION error body (backend spec §3.2). */
export interface InsufficientAllocationErrorDto {
  availableSlackHours: number;
  suggestedAction: 'extend_allocation';
}

export interface CreateTaskStatusRequestDto {
  name: string;
  displayOrder: number;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
  requiresApproval: boolean;
  approverId?: string;
}

export interface EditTaskStatusRequestDto {
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  approverId?: string;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
}

export interface ClockInResponseDto {
  movedToStatus: { id: string; name: string; color: string } | null;
}
