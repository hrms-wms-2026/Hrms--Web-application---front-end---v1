/** GET planner/team (Today's team schedule, My Team widgets design 2026-10-29 section 6.2). Minutes, never estimate hours. */

export type TeamScheduleTaskStatus =
  'completed' | 'in_progress' | 'pending' | 'scheduled_not_clocked';
export type TeamScheduleMeetingStatus = 'upcoming' | 'in_meeting' | 'finished' | 'cancelled';
export type TeamScheduleNotRankedReason =
  'none' | 'no_items_yet' | 'no_planned_task_time' | 'on_leave' | 'planner_off';

export interface TeamScheduleItem {
  kind: 'task' | 'meeting';
  taskId: string;
  /** "Private meeting" for a private meeting. */
  title: string;
  start: string;
  end: string;
  status: TeamScheduleTaskStatus | TeamScheduleMeetingStatus;
  isPrivate: boolean;
}

export interface TeamScheduleUnscheduled {
  taskId: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
  kind: 'no_plan' | 'outside_slot';
}

export interface TeamScheduleConflict {
  kind: 'block_meeting' | 'parallel_clock';
  start: string;
  end: string;
  firstTitle: string;
  secondTitle: string;
}

export interface TeamScheduleMember {
  employeeId: string;
  displayName: string;
  avatarFileId: string | null;
  timezone: string;
  /** The Team Status status when the viewer covers this person's attendance (today only). */
  presenceStatus: string | null;
  plannedTaskMinutes: number;
  plannedMeetingMinutes: number;
  clockedMinutes: number;
  scheduledMinutes: number;
  outsideSlotMinutes: number;
  noPlanMinutes: number;
  itemCompletionPercent: number | null;
  timeCoveragePercent: number | null;
  score: number | null;
  notRankedReason: TeamScheduleNotRankedReason;
  rank: number | null;
  items: TeamScheduleItem[];
  unscheduled: TeamScheduleUnscheduled[];
  conflicts: TeamScheduleConflict[];
  /** The work window today (Team Status); null without presence. */
  expectedMinutes: number | null;
  /** Today's breaks (Team Status); empty without presence. */
  breaks: TeamScheduleBreak[];
}

export interface TeamScheduleBreak {
  start: string;
  end: string | null;
}

export interface TeamScheduleSummary {
  people: number;
  tasksPlanned: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksPending: number;
  meetings: number;
  peopleWithUnscheduledWork: number;
  unscheduledMinutes: number;
  conflicts: number;
}

export interface TeamScheduleResponse {
  date: string;
  plannerEnabled: boolean;
  asOf: string;
  summary: TeamScheduleSummary;
  members: TeamScheduleMember[];
}

/**
 * GET planner/team/week (2026-11-02 design match section 7.4): the same population, each person's minutes on their own
 * local days. Planner off = every plan field 0 and coverage null; clocked minutes still filled.
 */
export interface TeamWeekDay {
  date: string;
  plannedTaskMinutes: number;
  plannedMeetingMinutes: number;
  clockedMinutes: number;
  scheduledMinutes: number;
  outsideSlotMinutes: number;
  noPlanMinutes: number;
}

export interface TeamWeekTotals {
  /** Task + meeting minutes for the whole week (previous: planned task minutes of the elapsed span). */
  plannedMinutes: number;
  clockedMinutes: number;
  scheduledMinutes: number;
  /** Outside slot + no plan. */
  unscheduledMinutes: number;
  /** Scheduled / planned task minutes elapsed so far, capped at 100; null without elapsed plan. */
  coveragePercent: number | null;
}

export interface TeamWeekMember {
  employeeId: string;
  displayName: string;
  avatarFileId: string | null;
  plannedMinutes: number;
  clockedMinutes: number;
  scheduledMinutes: number;
  unscheduledMinutes: number;
  coveragePercent: number | null;
}

export interface TeamScheduleWeekResponse {
  weekStart: string;
  weekEnd: string;
  plannerEnabled: boolean;
  asOf: string;
  days: TeamWeekDay[];
  totals: TeamWeekTotals;
  /** The same elapsed span of the week before. */
  previous: TeamWeekTotals;
  /** Ordered by planned, then clocked, then name (the workload order). */
  members: TeamWeekMember[];
}
