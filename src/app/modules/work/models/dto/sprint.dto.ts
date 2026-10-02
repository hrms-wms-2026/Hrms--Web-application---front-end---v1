export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'active' | 'complete' | 'achieved';
  completedAt: string | null;
  achievedAt: string | null;
  canManage: boolean;
}

export interface CreateSprintRequestDto {
  name: string;
  goal?: string;
  taskIds?: string[];
}

export interface StartSprintRequestDto {
  startDate: string;
  endDate: string;
  goal?: string;
}

export interface EditSprintRequestDto {
  name: string;
  goal: string | null;
  startDate?: string;
  endDate?: string;
}

export interface CompleteSprintRequestDto {
  disposition: 'backlog' | 'sprint';
  targetSprintId?: string;
}

export interface SetSprintTasksRequestDto {
  addTaskIds: string[];
  removeTaskIds: string[];
}

export interface SprintActivityDto {
  id: string;
  employeeId: string;
  action: 'created' | 'edited' | 'started' | 'completed' | 'achieved' | 'tasks_added' | 'tasks_removed';
  fromStatus: string | null;
  toStatus: string | null;
  detailsJson: string | null;
  occurredAt: string;
}
