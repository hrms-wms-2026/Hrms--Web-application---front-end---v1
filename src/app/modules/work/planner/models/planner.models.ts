/** Day planner (backend docs/api/planner-v1.md). Times are ISO strings; the day is in `timezone`. */
export interface PlannerBlockView {
  id: string;
  taskId: string;
  taskTitle: string;
  startAt: string;
  endAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  stillAssigned: boolean;
  overlapsMeeting: boolean;
}

export interface PlannerMeetingView {
  taskId: string;
  seriesId: string;
  originalStart: string;
  startAt: string;
  endAt: string;
  title: string;
  isPrivate: boolean;
  cancelled: boolean;
  declined: boolean;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface PlannerDueTaskView {
  taskId: string;
  title: string;
  dueDate: string | null;
  estimatedHours: number | null;
}

export interface PlannerTotals {
  plannedMinutes: number;
  actualMinutes: number;
}

export interface PlannerDayResponse {
  date: string;
  timezone: string;
  editable: boolean;
  blocks: PlannerBlockView[];
  meetings: PlannerMeetingView[];
  dueTasks: PlannerDueTaskView[];
  totals: PlannerTotals;
  /** The attendance clock for the day (worked minutes; while clocked in, since clock-in less breaks). */
  attendanceMinutes: number;
}

export interface CreatePlannedBlockRequest {
  taskId: string;
  startAt: string;
  endAt: string;
}

export interface MovePlannedBlockRequest {
  startAt: string;
  endAt: string;
}
