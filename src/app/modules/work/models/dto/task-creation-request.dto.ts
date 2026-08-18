export interface TaskCreationRequestPayloadDto {
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  storyPoints: number | null;
}

export interface TaskCreationRequestDto {
  id: string;
  objectiveId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: TaskCreationRequestPayloadDto;
  createdAt: string;
}

export interface CreateTaskCreationRequestDto {
  title: string;
  description?: string;
  taskType: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
}
