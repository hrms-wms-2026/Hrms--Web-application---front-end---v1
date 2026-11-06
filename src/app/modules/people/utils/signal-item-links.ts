import { EmployeeSignalItem } from '../models/employee-overview.model';

const ATTENDANCE_KEYS = new Set([
  'absent_days', 'missing_clock_outs', 'over_break', 'late_clock_ins', 'early_clock_outs',
  'short_hours_days', 'off_schedule_work', 'location_violations'
]);

/** Attendance approval kinds and their Inbox kinds (attendance requests are reviewed in the Inbox). */
const ATTENDANCE_INBOX_KINDS: Record<string, string> = {
  attendance_correction: 'correction',
  work_area_change: 'work_mode_change',
  location_change: 'location_change',
  device_change: 'device_change'
};

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

/** Where a pending approval is reviewed: leave and attendance requests open in the Inbox; work approvals go to the
 *  project list. */
export function approvalReviewUrl(item: EmployeeSignalItem): string {
  const kind = item.approvalKind ?? '';
  if (kind === 'leave') return `/inbox/leave/request/${item.id}`;
  const inboxKind = ATTENDANCE_INBOX_KINDS[kind];
  if (inboxKind) return `/inbox/attendance/${inboxKind}/${item.id}`;
  return '/work';
}

/** The module page listing everything behind a signal, for capped lists. */
export function signalFullListUrl(key: string, employeeId: string, from: string, to: string): string | null {
  if (ATTENDANCE_KEYS.has(key)) {
    return withQuery('/attendance', { view: 'team', employeeId, from, to });
  }
  // Alerts and exception cases are reviewed in the Inbox, filtered to this employee.
  if (key === 'idle_activity_alerts') return withQuery('/inbox', { tab: 'alerts', employee: employeeId });
  if (key === 'monitoring_exceptions') return withQuery('/inbox', { source: 'monitoring', tab: 'alerts', employee: employeeId });
  if (key === 'overdue_tasks') return '/work';
  return null;
}

/** Board fallback when the task modal cannot load the task's project. */
export function taskBoardUrl(item: EmployeeSignalItem): string {
  return withQuery(`/work/${item.projectId}/board`, { taskId: item.id });
}
