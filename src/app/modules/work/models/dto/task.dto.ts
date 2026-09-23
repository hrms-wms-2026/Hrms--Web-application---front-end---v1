import { TaskStatusCategory } from '../task.model';

export interface TaskStatusDto {
  id: string;
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
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
  avatarUrl: string | null;
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
}

export interface CreateSubtaskRequestDto {
  title: string;
  priority?: WorkTaskDto['priority'];
  dueDate?: string;
  assigneeEmployeeId?: string;
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
