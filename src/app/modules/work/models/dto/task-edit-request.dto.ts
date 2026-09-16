export interface TaskEditRequestPayloadDto {
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  storyPoints: number | null;
  progressPercent?: number | null;
  sprintId?: string | null;
}

export interface TaskEditRequestDto {
  id: string;
  taskId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: TaskEditRequestPayloadDto;
  requestedByName: string;
  createdAt: string;
}

export interface CreateTaskEditRequestDto {
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  progressPercent?: number;
  reason?: string;
  sprintId?: string | null;
}
