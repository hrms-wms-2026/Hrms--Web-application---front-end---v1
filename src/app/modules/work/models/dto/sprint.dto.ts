export interface SprintDto {
  id: string;
  objectiveId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'future' | 'active' | 'complete' | 'incomplete' | 'achieved';
  completedAt: string | null;
  achievedAt: string | null;
}

export interface CreateSprintRequestDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface EditSprintRequestDto {
  name: string;
  startDate: string;
  endDate: string;
}
