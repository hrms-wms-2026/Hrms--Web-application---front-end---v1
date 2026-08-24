export type SprintStatus = 'future' | 'active' | 'complete' | 'incomplete' | 'achieved';

export interface Sprint {
  id: string;
  objectiveId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  completedAt: Date | null;
  achievedAt: Date | null;
}
