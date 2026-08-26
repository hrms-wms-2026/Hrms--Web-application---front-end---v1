export interface TaskStatusColumn {
  id: string;
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  marksTaskComplete: boolean;
  visibility: 'public' | 'private';
}

export interface WorkTask {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  categoryId: string;
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
  sprintId: string | null;
    assigneeEmployeeIds: string[];
  openClockSessionEmployeeId: string | null;

}
