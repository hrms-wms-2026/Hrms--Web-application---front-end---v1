export interface TaskStatusDto {
  id: string;
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  approverId: string | null;
  marksTaskComplete: boolean;
  visibility: 'public' | 'private';
}

export interface WorkTaskDto {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  taskType: 'task' | 'bug' | 'story' | 'feature';
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: string | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
  sprintId: string | null;
  assigneeEmployeeIds: string[];
}

export interface CreateTaskRequestDto {
  title: string;
  description?: string;
  taskType: WorkTaskDto['taskType'];
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  sprintId: string;
}

export interface EditTaskRequestDto {
  title: string;
  description?: string;
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
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
  marksTaskComplete: boolean;
  requiresApproval: boolean;
  approverId?: string;
}

export interface EditTaskStatusRequestDto {
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  approverId?: string;
  visibility: 'public' | 'private';
}
