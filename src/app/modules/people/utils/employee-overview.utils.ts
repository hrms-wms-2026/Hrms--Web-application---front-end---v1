import { AttendanceDayStatus, EmployeeUpcomingItem } from '../models/employee-overview.model';

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

export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return currentMonthKey(new Date(year, monthNumber - 1 + delta, 1));
}

/** Inclusive, newest first. */
export function monthsBetween(min: string, max: string): readonly { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  for (let month = max; month >= min; month = shiftMonth(month, -1)) {
    months.push({ value: month, label: monthLabel(month) });
  }
  return months;
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

/** '83h 20m' style duration from whole minutes (negatives clamp to 0). */
export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`;
}

export type DeltaPolarity = 'higher-better' | 'lower-better' | 'neutral';

export interface Delta {
  readonly text: string;
  readonly direction: 'up' | 'down' | 'flat';
  readonly tone: 'good' | 'bad' | 'neutral';
}

/** Difference of a metric against the previous period, with a tone that respects which direction is good. */
export function computeDelta(
  current: number,
  previous: number,
  polarity: DeltaPolarity,
  format: (n: number) => string = String
): Delta {
  const diff = current - previous;
  if (diff === 0) return { text: 'No change', direction: 'flat', tone: 'neutral' };

  const improved = polarity === 'higher-better' ? diff > 0 : polarity === 'lower-better' ? diff < 0 : null;
  return {
    text: `${diff > 0 ? '+' : '-'}${format(Math.abs(diff))}`,
    direction: diff > 0 ? 'up' : 'down',
    tone: improved === null ? 'neutral' : improved ? 'good' : 'bad'
  };
}

/** 'Sep 12' from an ISO date or datetime, using its leading YYYY-MM-DD parts (UTC date). */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/** 24-hour 'HH:mm' in the given time zone (default: the viewer's local zone). */
export function formatEventTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
}

/** 'YYYY-MM-DD' of an instant in the given time zone ('en-CA' formats dates as ISO). */
function zonedDateKey(iso: string | Date, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

/** Date tile + time line for an upcoming item: 'SEP' / 30 / '18:00' (or 'All day', or the range for multi-day). */
export interface UpcomingDateBlock {
  readonly month: string;
  readonly day: number;
  readonly time: string;
}

export function upcomingDateBlock(item: EmployeeUpcomingItem, timeZone?: string): UpcomingDateBlock {
  let day: string;
  let time: string;
  if (item.isAllDay) {
    day = item.start.slice(0, 10);
    const endDay = item.end ? item.end.slice(0, 10) : day;
    time = day === endDay ? 'All day' : formatLeaveRange(day, endDay);
  } else {
    day = zonedDateKey(item.start, timeZone);
    time = formatEventTime(item.start, timeZone);
  }
  const [, month, dayOfMonth] = day.split('-').map(Number);
  return { month: MONTH_NAMES[month - 1].toUpperCase(), day: dayOfMonth, time };
}

/** 'Today, 14:41' / 'Yesterday, 18:12' / 'Sep 16, 16:32', deciding the day in the given zone. */
export function formatActivityWhen(iso: string, now: Date, timeZone?: string): string {
  const day = zonedDateKey(iso, timeZone);
  const today = zonedDateKey(now, timeZone);
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const time = formatEventTime(iso, timeZone);
  if (day === today) return `Today, ${time}`;
  if (day === yesterday) return `Yesterday, ${time}`;
  return `${formatShortDate(day)}, ${time}`;
}

/** 'Sep 10, 2026' from an ISO date (string parts, no Date parsing). */
export function formatDateWithYear(isoDate: string): string {
  return `${formatShortDate(isoDate)}, ${isoDate.slice(0, 4)}`;
}

export function progressPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
