/** Team Progress: paged employee breakdown, period summary and weekly completion of the caller's led scope.
 * Hours are task estimates (weightage), never time worked. See TEAM_PROGRESS_WIDGET_CONTRACT.md. */

export type LedSortDirection = 'asc' | 'desc';

export type LedTaskStatus = 'completed' | 'inProgress' | 'notStarted';

export type LedEmployeeSort = 'totalHours' | 'completedHours' | 'inProgressHours' | 'notStartedHours' | 'name';

interface LedPage<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** One assignee's share. A multi-assignee task counts its full estimate for each assignee (and is
 * counted in `sharedTaskCount` / `sharedHours`), so employee totals can exceed the team total. */
export interface LedEmployeeProgress {
  employeeId: string;
  displayName: string;
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  totalHours: number;
  taskCount: number;
  sharedTaskCount: number;
  sharedHours: number;
}

/** Tasks nobody is assigned to - reported separately, never attributed to an employee. */
export interface LedUnassignedTotals {
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  totalHours: number;
  taskCount: number;
}

export interface LedEmployeeProgressPage extends LedPage<LedEmployeeProgress> {
  unassigned: LedUnassignedTotals;
}

export interface LedEmployeeQuery {
  pageNumber: number;
  pageSize: number;
  /** Due-date window; omitted (or "all") means no window. */
  period?: LedProgressPeriod;
  search?: string;
  projectId?: string;
  objectiveId?: string;
  sort: LedEmployeeSort;
  direction: LedSortDirection;
}

/** The Team Progress period switch. 'all' is the bootstrap led-progress payload; 'week' and 'month'
 * count only top-level in-scope tasks due in the current ISO week / calendar month (server UTC). */
export type LedProgressPeriod = 'all' | 'month' | 'week';

/** GET work/led-progress/period?period=week|month. No allocation figures: allocations have no date,
 * so "not yet tasked" and over-tasked do not exist for a period. */
export interface LedPeriodProgress {
  period: Exclude<LedProgressPeriod, 'all'>;
  /** yyyy-MM-dd, inclusive. */
  from: string;
  /** yyyy-MM-dd, inclusive. */
  to: string;
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  totalHours: number;
  taskCount: number;
  completedTaskCount: number;
  inProgressTaskCount: number;
  notStartedTaskCount: number;
  unestimatedTaskCount: number;
}

/** One ISO week (Monday..Sunday, UTC) of completed task estimates. */
export interface LedWeeklyCompletionWeek {
  /** yyyy-MM-dd, Monday. */
  weekStart: string;
  /** yyyy-MM-dd, Sunday. */
  weekEnd: string;
  /** Estimates of top-level tasks completed in the week (by CompletedAt) that are still done. */
  completedHours: number;
  completedTaskCount: number;
}

/** GET work/led-progress/weekly-completion. `weeks` is oldest first; the last one is the current,
 * partial week. Done tasks without a completion date can't be placed in a week: they are reported
 * as `undated*` instead of being guessed. */
export interface LedWeeklyCompletion {
  weeks: LedWeeklyCompletionWeek[];
  /** Allocation of the (filtered) led scope, so a week can be read as a share of it. */
  allocatedHours: number;
  undatedCompletedHours: number;
  undatedCompletedTaskCount: number;
}

/** GET led-progress/time (My Team widgets design 2026-10-29, section 6.1): Planner blocks and clocked task time on the led
 * scope's tasks. Minutes of planned / worked time - never estimate hours, never added to them or drawn on their axis. */
export type LedTimePeriod = 'week' | 'month';

export interface LedTimeComparison {
  /** Planned task minutes elapsed by the same point of the previous period. */
  plannedMinutes: number;
  clockedMinutes: number;
  coveragePercent: number | null;
}

/** A day (week) or an ISO week clipped to the month (month). */
export interface LedTimeBucket {
  from: string;
  to: string;
  plannedMinutes: number;
  scheduledMinutes: number;
  unscheduledMinutes: number;
}

export interface LedWorkloadRow {
  employeeId: string;
  displayName: string;
  rank: number;
  plannedMinutes: number;
  clockedMinutes: number;
  unscheduledMinutes: number;
  /** Null when the person's legal entity has no working hours. */
  expectedMinutes: number | null;
  /** Planned / expected; not capped. */
  utilizationPercent: number | null;
}

export interface LedUnscheduledRow {
  employeeId: string;
  displayName: string;
  taskId: string;
  shortId: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
  kind: 'no_plan' | 'outside_slot';
}

export interface LedTimeProgress {
  period: LedTimePeriod;
  from: string;
  to: string;
  plannerEnabled: boolean;
  asOf: string;
  /** The whole period's planned commitment. */
  plannedMinutes: number;
  clockedMinutes: number;
  scheduledMinutes: number;
  outsideSlotMinutes: number;
  noPlanMinutes: number;
  /** Scheduled / planned task minutes elapsed so far; null without a plan. */
  coveragePercent: number | null;
  peopleWithUnscheduledWork: number;
  previous: LedTimeComparison;
  buckets: LedTimeBucket[];
  workload: LedWorkloadRow[];
  /** The newest 200; unscheduledTotal is the full count. */
  unscheduled: LedUnscheduledRow[];
  unscheduledTotal: number;
}
