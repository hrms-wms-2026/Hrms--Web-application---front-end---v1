export interface SprintDto {
  id: string;
  objectiveId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'active' | 'complete' | 'achieved';
  completedAt: string | null;
  achievedAt: string | null;
}

export interface CreateSprintRequestDto {
  name: string;
  goal?: string;
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
