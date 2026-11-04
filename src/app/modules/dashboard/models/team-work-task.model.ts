/** My Team "Work vs task hours": GET attendance/time-tracking/team/work-vs-task. Minutes throughout. */
export type TeamWorkTaskPeriod = 'day' | 'week' | 'month';

export interface TeamWorkTaskQuery {
  readonly period: TeamWorkTaskPeriod;
  /** Any yyyy-MM-dd inside the wanted period; null = the period containing today. */
  readonly anchor: string | null;
}

export interface TeamWorkTaskTotals {
  /** Attendance working time: clocked time less breaks. */
  readonly workedMinutes: number;
  readonly breakMinutes: number;
  /** Estimated hours of the top-level tasks completed in the range. */
  readonly taskMinutes: number;
  readonly completedTasks: number;
  /** Completed tasks with no estimate (they add 0 minutes). */
  readonly unestimatedTasks: number;
  /** Task time as a percent of working time (one decimal); null with no working time. Can pass 100. */
  readonly utilization: number | null;
}

export interface TeamWorkTaskTrendPoint {
  readonly date: string;
  readonly workedMinutes: number;
  readonly breakMinutes: number;
  readonly taskMinutes: number;
  readonly completedTasks: number;
  readonly utilization: number | null;
}

export interface TeamWorkTaskEmployeeRow extends TeamWorkTaskTotals {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly department: string | null;
  /** Competition rank by utilization, highest first; null without working time. */
  readonly rank: number | null;
}

export interface TeamWorkTaskHoursResponse {
  readonly period: TeamWorkTaskPeriod;
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly today: string;
  readonly isProvisional: boolean;
  readonly teamSize: number;
  readonly totals: TeamWorkTaskTotals;
  readonly previous: TeamWorkTaskTotals;
  /** The chart's days: the ISO week around a day, else the range. */
  readonly trendStart: string;
  readonly trendEnd: string;
  readonly trend: readonly TeamWorkTaskTrendPoint[];
  readonly employees: readonly TeamWorkTaskEmployeeRow[];
  readonly calculatedAtUtc: string;
}
