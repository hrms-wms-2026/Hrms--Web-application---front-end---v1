import { TeamWorkTaskPeriod, TeamWorkTaskTotals } from '../models/team-work-task.model';
import { minutesText } from './team-presence-format.util';

/** Task time (completed estimates), the rest of the working time, and breaks. */
export const TEAM_WORK_TASK_COLORS = {
  task: '#10b981',
  other: '#3b82f6',
  break: '#f59e0b',
} as const;

export type TeamWorkTaskSlice = keyof typeof TEAM_WORK_TASK_COLORS;

export const TEAM_WORK_TASK_LABELS: Record<TeamWorkTaskSlice, string> = {
  task: 'Task hours',
  other: 'Other work time',
  break: 'Break',
};

export interface TeamWorkTaskSliceRow {
  readonly key: TeamWorkTaskSlice;
  readonly label: string;
  readonly minutes: number;
  /** Share of worked + break time, whole percent. */
  readonly percent: number;
  readonly color: string;
}

/** The pie's three slices. Task time is capped at the working time, so a team that completed more estimated work
 * than it clocked shows an all-task pie, never a negative "other". */
export function teamWorkTaskSlices(t: TeamWorkTaskTotals): TeamWorkTaskSliceRow[] {
  const task = Math.min(t.taskMinutes, t.workedMinutes);
  const other = Math.max(0, t.workedMinutes - t.taskMinutes);
  const whole = t.workedMinutes + t.breakMinutes;
  const share = (n: number) => (whole > 0 ? Math.round((n * 100) / whole) : 0);
  const row = (key: TeamWorkTaskSlice, minutes: number): TeamWorkTaskSliceRow => ({
    key,
    label: TEAM_WORK_TASK_LABELS[key],
    minutes,
    percent: share(minutes),
    color: TEAM_WORK_TASK_COLORS[key],
  });
  return [row('task', task), row('other', other), row('break', t.breakMinutes)];
}

/** "12h 30m"-style hours, "0h" for nothing. */
export function hoursText(minutes: number): string {
  return minutes > 0 ? minutesText(minutes) : '0h';
}

/** Hours short enough for a 52px KPI tile: exact under 10h ("5h 30m"), whole hours from there ("673h"). */
export function compactHoursText(minutes: number): string {
  if (minutes < 600) return hoursText(minutes);
  return `${Math.round(minutes / 60).toLocaleString('en-US')}h`;
}

/** Utilization as a percent ("—" without working time); one decimal under 10%, else whole. */
export function utilizationText(value: number | null): string {
  if (value === null) return '—';
  if (value > 0 && value < 0.1) return '<0.1%';
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)}%`;
}

const PREVIOUS_NAME: Record<TeamWorkTaskPeriod, string> = {
  day: 'yesterday',
  week: 'last week',
  month: 'last month',
};

/** The change in utilization against the previous period, in percentage points; null when either side has no time. */
export function teamWorkTaskDelta(
  current: number | null,
  previous: number | null,
  period: TeamWorkTaskPeriod,
): { text: string; down: boolean } | null {
  if (current === null || previous === null) return null;
  const pp = Math.round((current - previous) * 10) / 10;
  if (pp === 0) return { text: `Same as ${PREVIOUS_NAME[period]}`, down: false };
  return {
    text: `${pp > 0 ? '↑' : '↓'} ${Math.abs(pp)} pp vs ${PREVIOUS_NAME[period]}`,
    down: pp < 0,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(iso: string): { y: number; m: number; d: number; weekday: string } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

/** "Wed 30 Sep 2026", "28 Sep – 4 Oct 2026" or "September 2026". */
export function teamWorkTaskRangeLabel(
  period: TeamWorkTaskPeriod,
  start: string,
  end: string,
): string {
  const a = parts(start);
  if (period === 'day') return `${a.weekday} ${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (period === 'month') {
    const long = new Date(Date.UTC(a.y, a.m - 1, 1)).toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    return `${long} ${a.y}`;
  }
  const b = parts(end);
  const left = a.m === b.m ? `${a.d}` : `${a.d} ${MONTHS[a.m - 1]}`;
  return `${left} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

/** The caption under the hero figure: what the percentage means for this period. */
export function teamWorkTaskCaption(period: TeamWorkTaskPeriod): string {
  return period === 'day'
    ? 'Task hours of work time today'
    : period === 'week'
      ? 'Task hours of work time this week'
      : 'Task hours of work time this month';
}

/** A short weekday ("Mon") or, for a month's days, the day number. */
export function trendLabel(iso: string, monthly: boolean): string {
  const p = parts(iso);
  return monthly ? String(p.d) : p.weekday;
}
