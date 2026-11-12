import { TeamAttendanceBucket, TeamAttendancePeriodMode } from '../models/team-attendance.model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Status colours, the same palette as the day chart. */
export const TEAM_ATTENDANCE_COLORS: Record<Exclude<TeamAttendanceBucket, 'off'>, string> = {
  present: '#34d399',
  late: '#fbbf24',
  absent: '#f87171',
  leave: '#60a5fa',
  pending: '#cbd5e1'
};

export const TEAM_ATTENDANCE_LABELS: Record<TeamAttendanceBucket, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'On leave',
  pending: 'Not in yet',
  off: 'Off'
};

/** "26 Oct – 1 Nov" for a week, "October 2026" for a month; dates are read without a time zone. */
/** Departments worst rate first, so problem departments come first; departments with no rate go last, then by name.
 * The popup's department bars and the summary card use this one order. */
export function departmentsWorstFirst<T extends { readonly name: string; readonly rate: number | null }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.rate === null || b.rate === null) {
      return a.rate === b.rate ? a.name.localeCompare(b.name) : a.rate === null ? 1 : -1;
    }
    return a.rate - b.rate || a.name.localeCompare(b.name);
  });
}

export function teamAttendanceRangeLabel(mode: TeamAttendancePeriodMode, start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  if (mode === 'month') return `${LONG_MONTHS[sm - 1]} ${sy}`;
  return sm === em ? `${sd} – ${ed} ${MONTHS[em - 1]}` : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}

/** "↑ 4 pp vs last week"; null when there is nothing to compare. */
export function teamAttendanceDelta(deltaPp: number | null, mode: TeamAttendancePeriodMode): { text: string; down: boolean } | null {
  if (deltaPp === null) return null;
  const arrow = deltaPp > 0 ? '↑' : deltaPp < 0 ? '↓' : '±';
  return { text: `${arrow} ${Math.abs(deltaPp)} pp vs last ${mode}`, down: deltaPp < 0 };
}
