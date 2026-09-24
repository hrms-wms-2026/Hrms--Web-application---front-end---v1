export type SprintStatus = 'draft' | 'active' | 'complete' | 'achieved';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
  completedAt: Date | null;
  achievedAt: Date | null;
  canManage: boolean;
}
