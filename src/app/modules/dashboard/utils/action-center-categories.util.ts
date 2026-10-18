import { ActionCenterCategory } from '../models/action-center-category.model';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { formatOldestWaiting } from './oldest-pending.util';

export const ACTION_CENTER_CATEGORY_LABEL: Record<string, string> = {
  'leave.approval': 'Leave requests',
  'attendance.correction': 'Attendance corrections',
  'attendance.work_area': 'Work-area changes',
  'attendance.location': 'Location changes',
  'attendance.device_change': 'Device changes',
  'monitoring.exception': 'Exceptions',
  'calendar.meeting_exception': 'Meeting exceptions',
  'work.task_creation': 'Task creation requests',
  'work.task_edit': 'Task edit requests',
  'work.objective_change': 'Objective changes',
  'work.status_template_change': 'Status template changes'
};

/** Ports approvals-exceptions-card.component.ts's category grouping/labeling (pre-consolidation)
 * into a pure function - the Action Center rail's data, independent of the priority queue's
 * composer (priority-actions.util.ts), which is unchanged and reused as-is for the queue half. */
export function buildActionCenterCategories(data: TeamActionItemsResponse | null): ActionCenterCategory[] {
  if (!data) return [];
  return data.sources.map((source) => ({
    sourceKey: source.sourceKey,
    label: ACTION_CENTER_CATEGORY_LABEL[source.sourceKey] ?? source.sourceKey,
    domain: source.domain,
    status: source.status,
    pendingCount: source.pendingCount,
    oldestWaitingLabel: formatOldestWaiting(source.oldestPendingAt)
  }));
}
