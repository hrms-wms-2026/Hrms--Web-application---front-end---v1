import { AttendanceDayStatus } from '../models/employee-overview.model';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM' for the given local date. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** Inclusive ISO date bounds for a 'YYYY-MM' month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad2(lastDay)}` };
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/** Newest first, starting at the month containing `now`. */
export function recentMonths(now: Date = new Date(), count = 12): readonly { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = currentMonthKey(date);
    months.push({ value, label: monthLabel(value) });
  }
  return months;
}

export function formatHours(value: number): string {
  return `${Math.round(value * 100) / 100} h`;
}

function shortDate(iso: string): { month: string; day: number } {
  const [, month, day] = iso.split('-').map(Number);
  return { month: MONTH_NAMES[month - 1], day };
}

/** 'Sep 23', 'Sep 23 – 25' or 'Sep 30 – Oct 2' from ISO dates (string parts, no Date parsing). */
export function formatLeaveRange(start: string, end: string): string {
  const s = shortDate(start);
  const e = shortDate(end);
  if (start === end) return `${s.month} ${s.day}`;
  if (s.month === e.month) return `${s.month} ${s.day} – ${e.day}`;
  return `${s.month} ${s.day} – ${e.month} ${e.day}`;
}

const DAY_LABELS: Record<AttendanceDayStatus, string> = {
  present: 'Present',
  late: 'Late',
  missing_clock_out: 'Missing clock-out',
  leave: 'On leave',
  off: 'Day off',
  absent: 'Absent',
  none: 'Upcoming'
};

export function attendanceDayLabel(status: AttendanceDayStatus): string {
  return DAY_LABELS[status];
}
