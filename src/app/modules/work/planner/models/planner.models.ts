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

/** A day's working hours from the legal entity, as wall-clock in the employee's zone (planner API v1.1). */
export interface PlannerWorkWindow {
  /** "HH:mm:ss". */
  workStart: string;
  workEnd: string;
  breakMinutes: number;
  breakStart: string | null;
  isWorkingDay: boolean;
  workingMinutes: number;
}

export interface PlannerRangeBlockView {
  id: string;
  taskId: string;
  projectId: string;
  /** Absent from an API that predates the redesign (the block then shows no project line). */
  projectName?: string;
  taskTitle: string;
  startAt: string;
  endAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  stillAssigned: boolean;
  /** The category's name and fixed type; absent from an older API (treated as a plain task). */
  categoryName?: string;
  categoryKind?: string;
  /** The category's picked icon; none shows the kind's own. */
  categoryIcon?: string | null;
}

export interface PlannerRangeDay {
  date: string;
  editable: boolean;
  workWindow: PlannerWorkWindow | null;
  blocks: PlannerRangeBlockView[];
  blockMinutes: number;
  workingMinutes: number;
}

/** GET /planner/me/range: the caller's days for the calendar grid (at most 42). */
export interface PlannerRangeResponse {
  timezone: string;
  today: string;
  days: PlannerRangeDay[];
}

export type PlannerFocusReason = 'overdue' | 'due_today' | 'due_this_week' | 'backlog';

export interface PlannerFocusItem {
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  priority: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  /** Everyone's clocked minutes on the task. */
  loggedMinutes: number;
  remainingMinutes: number | null;
  plannedAheadMinutes: number;
  firstPlannedDate: string | null;
  plannedDayCount: number;
  fullyPlanned: boolean;
  reason: PlannerFocusReason;
  /** The category's name and fixed type; absent from an older API (treated as a plain task). */
  categoryName?: string;
  categoryKind?: string;
  /** The category's picked icon; none shows the kind's own. */
  categoryIcon?: string | null;
  /** When the task was created: "Open N days" on an overdue card. */
  createdAt?: string;
}

export interface PlannerFocusGroup {
  reason: PlannerFocusReason;
  /** Every task in the group; `items` keeps the first 50. */
  count: number;
  items: PlannerFocusItem[];
}

/** GET /planner/me/focus: always the four groups, in the order overdue, due today, due this week, backlog. */
export interface PlannerFocusResponse {
  today: string;
  weekEnd: string;
  groups: PlannerFocusGroup[];
}
