export interface TeamTodayLeave {
  leaveTypeName: string;
  endsOn: string;
}

export interface TeamTodayMember {
  employeeId: string;
  displayName: string;
  avatarFileId: string | null;
  positionTitle: string | null;
  status: string;
  statusLabel: string;
  isLate: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  attentionType: string | null;
  attentionLabel: string | null;
  attentionSeverity: string | null;
  leave: TeamTodayLeave | null;
  /** Working: the clock-in; on break: the open break's start; otherwise null. */
  stateSince: string | null;
  /** On break with a configured allowance only. */
  breakRemainingMinutes: number | null;
  /** Working or on break with a scheduled end only. */
  shiftEndsAt: string | null;
  /** Attendance minutes today (breaks excluded); 0 without a record. */
  attendanceMinutes: number;
  /** The legal entity's work window today in minutes; 0 on leave, null without working hours. */
  expectedMinutes: number | null;
  /** Today's breaks ordered by start; an open break has a null end. */
  breaks: TeamTodayBreak[];
}

export interface TeamTodayBreak {
  start: string;
  end: string | null;
}

export interface TeamTodaySummary {
  total: number;
  working: number;
  onBreak: number;
  clockedOut: number;
  late: number;
  absent: number;
  notStarted: number;
  onLeave: number;
  notScheduled: number;
  needsAttention: number;
}

export interface TeamTodayResponse {
  workDate: string;
  timezone: string;
  legalEntityId: string;
  summary: TeamTodaySummary;
  members: TeamTodayMember[];
  totalMembers: number;
  /** When the server resolved the statuses. */
  asOf: string;
}

/** One day of GET attendance/time-tracking/team/working-hours: attendance minutes, never task or planned time. */
export interface TeamWorkingHoursDay {
  date: string;
  workedMinutes: number;
  breakMinutes: number;
  /** Approved leave, counted only for people the viewer may see leave for. */
  onLeaveCount: number;
  peopleWithRecord: number;
}

export interface TeamWorkingHoursResponse {
  weekStart: string;
  weekEnd: string;
  days: TeamWorkingHoursDay[];
}
