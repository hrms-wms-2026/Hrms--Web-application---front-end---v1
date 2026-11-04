import {
  TeamScheduleItem,
  TeamScheduleMember,
  TeamScheduleNotRankedReason,
  TeamScheduleSummary,
  TeamScheduleWeekResponse,
} from '../models/team-schedule.model';
import { PlannedActualDay, PlannedActualRow } from './planned-actual-format.util';
import { DonutArc, donutArcs } from './status-donut.util';

/** Item colours (2026-11-02 design match). Breaks are amber; unscheduled work is a red hatched strip. */
export const SCHEDULE_COLORS = {
  completed: '#10b981',
  inProgress: '#3b82f6',
  pending: '#cbd5e1',
  meeting: '#8b5cf6',
  break: '#f59e0b',
  unscheduled: '#ef4444',
  conflict: '#ef4444',
} as const;

/** Workload level thresholds over (planned task + meeting minutes) / the work window: High at 90% or more, Medium from
 * 60%, else Low (2026-11-02 design match section 7.5). */
export const WORKLOAD_HIGH = 0.9;
export const WORKLOAD_MEDIUM = 0.6;

const STATUS_LABEL: Record<string, string | undefined> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
  scheduled_not_clocked: 'Scheduled · not clocked',
  upcoming: 'Upcoming',
  in_meeting: 'In meeting',
  finished: 'Finished',
  cancelled: 'Cancelled',
};

export function itemStatusLabel(item: TeamScheduleItem): string {
  return STATUS_LABEL[item.status] ?? item.status;
}

export function itemColor(item: TeamScheduleItem): string {
  if (item.kind === 'meeting') return SCHEDULE_COLORS.meeting;
  if (item.status === 'completed') return SCHEDULE_COLORS.completed;
  if (item.status === 'in_progress') return SCHEDULE_COLORS.inProgress;
  return SCHEDULE_COLORS.pending;
}

/** The donut is over task status only: completed, in progress, pending. Meetings are a separate count. */
export function taskStatusDonut(summary: TeamScheduleSummary): DonutArc[] {
  return donutArcs([
    { key: 'completed', count: summary.tasksCompleted, color: SCHEDULE_COLORS.completed },
    { key: 'inProgress', count: summary.tasksInProgress, color: SCHEDULE_COLORS.inProgress },
    { key: 'pending', count: summary.tasksPending, color: SCHEDULE_COLORS.pending },
  ]);
}

const REASON_TEXT: Record<TeamScheduleNotRankedReason, string> = {
  none: '',
  no_items_yet: 'Nothing due yet',
  no_planned_task_time: 'No planned task time',
  on_leave: 'On leave',
  planner_off: 'Planner is off',
};

export function notRankedText(reason: TeamScheduleNotRankedReason): string {
  return REASON_TEXT[reason];
}

/** "—" for a missing percentage, never 0%. */
export function percentText(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

/** A person with no planned task: "No plan", never 0%. */
export function hasPlan(member: TeamScheduleMember): boolean {
  return member.plannedTaskMinutes > 0 || member.items.some((i) => i.kind === 'task');
}

export function completionText(member: TeamScheduleMember): string {
  return hasPlan(member) ? percentText(member.itemCompletionPercent) : 'No plan';
}

export function unscheduledMinutes(member: TeamScheduleMember): number {
  return member.outsideSlotMinutes + member.noPlanMinutes;
}

const HOUR = 3_600_000;

/** The hours a timeline shows, in the viewer's local time: the earliest item or segment start floored to the hour to
 * the latest end ceiled, at least 8 hours, kept inside 06:00-22:00 of the day. */
export function timelineSpan(
  members: readonly TeamScheduleMember[],
  day: string,
): { start: Date; end: Date } {
  const [y, m, d] = day.split('-').map(Number);
  const min = new Date(y, m - 1, d, 6).getTime();
  const max = new Date(y, m - 1, d, 22).getTime();
  const times = members.flatMap((member) => [
    ...member.items.flatMap((i) => [new Date(i.start).getTime(), new Date(i.end).getTime()]),
    ...member.unscheduled.flatMap((s) => [new Date(s.start).getTime(), new Date(s.end).getTime()]),
  ]);
  let start =
    times.length > 0
      ? Math.floor(Math.min(...times) / HOUR) * HOUR
      : new Date(y, m - 1, d, 9).getTime();
  let end = times.length > 0 ? Math.ceil(Math.max(...times) / HOUR) * HOUR : start + 8 * HOUR;
  start = Math.min(Math.max(start, min), max - 8 * HOUR);
  end = Math.max(Math.min(end, max), start + 8 * HOUR);
  return { start: new Date(start), end: new Date(Math.min(end, max)) };
}

/** Left offset and width (percent of the span) of an interval, clipped to the span; null when outside it. */
export function spanPosition(
  startIso: string,
  endIso: string,
  span: { start: Date; end: Date },
): { left: number; width: number } | null {
  const total = span.end.getTime() - span.start.getTime();
  const from = Math.max(new Date(startIso).getTime(), span.start.getTime());
  const to = Math.min(new Date(endIso).getTime(), span.end.getTime());
  if (!(total > 0) || to <= from) return null;
  return {
    left: ((from - span.start.getTime()) * 100) / total,
    width: ((to - from) * 100) / total,
  };
}

/** Hour ticks of a span: every hour (or every 2 when it is long). With maxLabels the step widens further so no
 * more than that many labels are drawn (a narrow axis never overlaps them). */
export function hourTicks(span: { start: Date; end: Date }, maxLabels?: number): { label: string; left: number }[] {
  const total = span.end.getTime() - span.start.getTime();
  let step = total > 10 * HOUR ? 2 : 1;
  if (maxLabels && maxLabels > 1 && total > 0) step = Math.max(step, Math.ceil(total / HOUR / (maxLabels - 1)));
  const ticks: { label: string; left: number }[] = [];
  for (let t = span.start.getTime(); t <= span.end.getTime(); t += step * HOUR) {
    ticks.push({
      label: `${String(new Date(t).getHours()).padStart(2, '0')}:00`,
      left: ((t - span.start.getTime()) * 100) / total,
    });
  }
  return ticks;
}

/** The card's donut over every item today: completed, in progress and pending tasks, and meetings. */
export function itemDonut(summary: TeamScheduleSummary): DonutArc[] {
  return donutArcs([
    { key: 'completed', count: summary.tasksCompleted, color: SCHEDULE_COLORS.completed },
    { key: 'inProgress', count: summary.tasksInProgress, color: SCHEDULE_COLORS.inProgress },
    { key: 'pending', count: summary.tasksPending, color: SCHEDULE_COLORS.pending },
    { key: 'meetings', count: summary.meetings, color: SCHEDULE_COLORS.meeting },
  ]);
}

/** What a labelled timeline block reads. */
export function timelineLabel(item: TeamScheduleItem): 'Task' | 'Meeting' {
  return item.kind === 'meeting' ? 'Meeting' : 'Task';
}

/** Each member as a planned-vs-actual row, in the backend's order. Planned = task + meeting minutes. */
export function toPlannedActualRows(members: readonly TeamScheduleMember[]): PlannedActualRow[] {
  return members.map((m) => ({
    id: m.employeeId,
    label: m.displayName,
    avatarFileId: m.avatarFileId,
    planned: m.plannedTaskMinutes + m.plannedMeetingMinutes,
    scheduled: m.scheduledMinutes,
    outside: m.outsideSlotMinutes,
    noPlan: m.noPlanMinutes,
    completion: m.itemCompletionPercent,
  }));
}

/** Today's breaks as closed intervals: an open break runs to now. */
export function breakSegments(member: TeamScheduleMember, now: Date): { start: string; end: string }[] {
  return member.breaks.map((b) => ({ start: b.start, end: b.end ?? now.toISOString() }));
}

/** High / Medium / Low against the work window; null without one (never a guessed level). */
export function workloadLevel(member: TeamScheduleMember): 'High' | 'Medium' | 'Low' | null {
  if (!member.expectedMinutes) return null;
  const share = (member.plannedTaskMinutes + member.plannedMeetingMinutes) / member.expectedMinutes;
  if (share >= WORKLOAD_HIGH) return 'High';
  return share >= WORKLOAD_MEDIUM ? 'Medium' : 'Low';
}

/** The week's days for app-planned-actual-week-chart. A day's coverage (in plan / planned task minutes, capped at 100)
 * only once the day is over: today's plan has not all elapsed, and the response has no per-day elapsed plan. */
export function toWeekChartDays(week: TeamScheduleWeekResponse, today: string | null): PlannedActualDay[] {
  return week.days.map((d) => ({
    date: d.date,
    planned: d.plannedTaskMinutes + d.plannedMeetingMinutes,
    scheduled: d.scheduledMinutes,
    outside: d.outsideSlotMinutes,
    noPlan: d.noPlanMinutes,
    coveragePercent:
      week.plannerEnabled && today !== null && d.date < today && d.plannedTaskMinutes > 0
        ? Math.min(100, Math.round((d.scheduledMinutes * 1000) / d.plannedTaskMinutes) / 10)
        : null,
  }));
}
