import { EmployeeSignalItem } from '../models/employee-overview.model';

const ATTENDANCE_KEYS = new Set([
  'absent_days', 'missing_clock_outs', 'over_break', 'late_clock_ins', 'early_clock_outs',
  'short_hours_days', 'off_schedule_work', 'location_violations'
]);

const TIME_TRACKING_APPROVAL_TYPES: Record<string, string> = {
  attendance_correction: 'corrections',
  work_area_change: 'work-area',
  location_change: 'location'
};

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

/** Where a pending approval is reviewed. Work approvals go to the project list. */
export function approvalReviewUrl(item: EmployeeSignalItem): string {
  const kind = item.approvalKind ?? '';
  if (kind === 'leave') return `/inbox/leave/request/${item.id}`;
  const type = TIME_TRACKING_APPROVAL_TYPES[kind];
  if (type) return withQuery('/attendance/time-tracking', { view: 'team', type, requestId: item.id });
  return '/work';
}

/** The module page listing everything behind a signal, for capped lists. */
export function signalFullListUrl(key: string, employeeId: string, from: string, to: string): string | null {
  if (ATTENDANCE_KEYS.has(key)) {
    return withQuery('/attendance/time-tracking', { view: 'team', employeeId, from, to });
  }
  if (key === 'idle_activity_alerts' || key === 'monitoring_exceptions') return '/attendance/alerts';
  if (key === 'overdue_tasks') return '/work';
  return null;
}

/** Board fallback when the task modal cannot load the task's project. */
export function taskBoardUrl(item: EmployeeSignalItem): string {
  return withQuery(`/work/${item.projectId}/board`, { taskId: item.id });
}
