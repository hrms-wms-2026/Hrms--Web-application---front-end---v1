/** GET planner/team (Today's team schedule, My Team widgets design 2026-10-29 section 6.2). Minutes, never estimate hours. */

export type TeamScheduleTaskStatus = 'completed' | 'in_progress' | 'pending' | 'scheduled_not_clocked';
export type TeamScheduleMeetingStatus = 'upcoming' | 'in_meeting' | 'finished' | 'cancelled';
export type TeamScheduleNotRankedReason = 'none' | 'no_items_yet' | 'no_planned_task_time' | 'on_leave' | 'planner_off';

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
