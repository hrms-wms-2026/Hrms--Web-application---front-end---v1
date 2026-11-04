/** GET work/my-weekly-progress (Weekly Work Progress widget). Minutes are whole minutes; percentages have one decimal. */
export type WeeklyProgressStatus = 'ahead' | 'on_track' | 'behind' | 'no_target';

export interface WeekDayProgress {
  /** yyyy-MM-dd in the employee's zone. */
  date: string;
  isExpected: boolean;
  isHoliday: boolean;
  leaveMinutes: number;
  expectedMinutes: number;
  scheduledMinutes: number;
  workedMinutes: number;
  attendanceMinutes: number;
}

export interface WeekProgress {
  expectedMinutes: number;
  expectedToDateMinutes: number;
  scheduledTaskMinutes: number;
  scheduledMeetingMinutes: number;
  scheduledMinutes: number;
  loggedTaskMinutes: number;
  creditedMeetingMinutes: number;
  /** Logged task minutes + credited meeting minutes (attendance is not part of it). */
  workedMinutes: number;
  attendanceMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  planningCoveragePercent: number;
  /** Null when nothing was scheduled on the days so far. */
  scheduleAdherencePercent: number | null;
  status: WeeklyProgressStatus;
  /** Monday to Sunday. */
  days: WeekDayProgress[];
}

/** Estimated hours of the week's tasks by status category: a separate metric from worked hours. */
export interface WeekTaskWeights {
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  unestimatedCount: number;
}

export interface WeeklyWorkProgressResponse {
  weekStart: string;
  weekEnd: string;
  today: string;
  timezone: string;
  /** When false the planner is switched off: scheduled figures are hidden, not shown as 0. */
  plannerEnabled: boolean;
  thisWeek: WeekProgress;
  lastWeek: WeekProgress;
  tasks: WeekTaskWeights;
}
