import { LeaveCalendarDayResponse } from '../models/leave-calendar.model';

export type AvailabilityBarKind = 'approved' | 'pending' | 'holiday';

/** One bar on a calendar week: a leave request or a holiday, from column `start` to `end` (0 = Sunday). */
export interface AvailabilityBar {
  id: string;
  label: string;
  kind: AvailabilityBarKind;
  start: number;
  end: number;
  lane: number;
  date: string;
}

export interface AvailabilityWeekDay {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
}

export interface AvailabilityWeek {
  days: AvailabilityWeekDay[];
  bars: AvailabilityBar[];
  lanes: number;
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Sunday-first weeks covering a month, each with its leave and holiday bars laid out in lanes so
 * bars that overlap in a week stack instead of covering each other. `visible` hides people.
 */
export function buildAvailabilityWeeks(
  year: number,
  month: number,
  days: readonly LeaveCalendarDayResponse[],
  visible: (employeeId: string) => boolean = () => true
): AvailabilityWeek[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const byDate = new Map(days.map((day) => [day.date, day]));
  const weeks: AvailabilityWeek[] = [];

  for (let cursor = new Date(start); cursor <= last; ) {
    const weekDays: AvailabilityWeekDay[] = [];
    // Per request (or holiday name): first and last column it covers this week.
    const spans = new Map<string, { label: string; kind: AvailabilityBarKind; start: number; end: number; date: string }>();
    for (let col = 0; col < 7; col += 1) {
      const date = isoDay(cursor);
      weekDays.push({ date, dayOfMonth: cursor.getDate(), inMonth: cursor.getMonth() === month - 1 });
      const day = byDate.get(date);
      for (const holiday of day?.holidays ?? []) {
        const key = `holiday:${holiday.name}`;
        const span = spans.get(key);
        if (span && span.end === col - 1) span.end = col;
        else if (!span) spans.set(key, { label: holiday.name, kind: 'holiday', start: col, end: col, date });
      }
      for (const absence of day?.absences ?? []) {
        if (!visible(absence.employeeId)) continue;
        const key = `leave:${absence.requestId}`;
        const span = spans.get(key);
        if (span) span.end = col;
        else
          spans.set(key, {
            label: `${absence.employeeName} – ${absence.leaveTypeName}`,
            kind: absence.isTentative || absence.status === 'pending' ? 'pending' : 'approved',
            start: col,
            end: col,
            date
          });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const laneEnds: number[] = [];
    const bars = [...spans.entries()]
      .sort(([, a], [, b]) => a.start - b.start || b.end - b.start - (a.end - a.start))
      .map(([id, span]) => {
        let lane = laneEnds.findIndex((end) => end < span.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(span.end);
        } else {
          laneEnds[lane] = span.end;
        }
        return { id, ...span, lane };
      });
    weeks.push({ days: weekDays, bars, lanes: laneEnds.length });
  }
  return weeks;
}

/** People off on a date, split by approved and pending leave. */
export function absentOn(days: readonly LeaveCalendarDayResponse[], date: string): { approved: Set<string>; pending: Set<string> } {
  const approved = new Set<string>();
  const pending = new Set<string>();
  for (const absence of days.find((day) => day.date === date)?.absences ?? []) {
    if (absence.isTentative || absence.status === 'pending') pending.add(absence.employeeId);
    else approved.add(absence.employeeId);
  }
  for (const id of approved) pending.delete(id);
  return { approved, pending };
}

/** Leave requests starting in the `windowDays` days after `today` (today included). */
export function upcomingAbsenceCount(days: readonly LeaveCalendarDayResponse[], today: string, windowDays: number): number {
  const end = parse(today);
  end.setDate(end.getDate() + windowDays - 1);
  const last = isoDay(end);
  const requests = new Set<string>();
  for (const day of days) {
    if (day.date < today || day.date > last) continue;
    for (const absence of day.absences) {
      if (absence.startAt.slice(0, 10) >= today) requests.add(absence.requestId);
    }
  }
  return requests.size;
}

/**
 * Working days where at least a quarter of the team (and at least two people) are off:
 * the days that are hard to staff.
 */
export function coverageConflictDays(days: readonly LeaveCalendarDayResponse[], teamSize: number): number {
  if (teamSize <= 0) return 0;
  const threshold = Math.max(2, Math.ceil(teamSize * 0.25));
  return days.filter((day) => new Set(day.absences.map((absence) => absence.employeeId)).size >= threshold).length;
}
