import { Project } from '../models/project.model';
import { getDeadlineStatus } from './deadline.util';

/** Where a project stands, for the Projects KPI strip, its filter and the status chips. */
export type ProjectStatus = 'completed' | 'overdue' | 'in_progress';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  completed: 'Completed',
  overdue: 'Overdue',
  in_progress: 'In progress'
};

/** Completed once achieved; otherwise overdue when the target date has passed; otherwise in progress. */
export function projectStatus(project: Pick<Project, 'isAchieved' | 'targetDate'>, today: Date = new Date()): ProjectStatus {
  if (project.isAchieved) return 'completed';
  return getDeadlineStatus(project.targetDate, today)?.overdue ? 'overdue' : 'in_progress';
}

/** Worked share of the allocated hours, 0-100 (0 when nothing is allocated). */
export function projectHoursProgress(project: Pick<Project, 'allocatedHours' | 'completedHours'>): number {
  if (project.allocatedHours <= 0) return 0;
  return Math.round((project.completedHours / project.allocatedHours) * 100);
}
