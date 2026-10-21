/** Team Progress detail dialog: paged employee and task breakdowns of the caller's led scope.
 * Hours are task estimates (weightage), never time worked. See TEAM_PROGRESS_WIDGET_CONTRACT.md. */

export type LedSortDirection = 'asc' | 'desc';

export type LedTaskStatus = 'completed' | 'inProgress' | 'notStarted';

export type LedEmployeeSort = 'totalHours' | 'completedHours' | 'inProgressHours' | 'notStartedHours' | 'name';

export type LedTaskSort = 'estimatedHours' | 'dueDate' | 'title' | 'status';

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

export interface LedTaskAssigneeRef {
  employeeId: string;
  displayName: string;
}

export interface LedTaskRow {
  taskId: string;
  shortId: string;
  title: string;
  status: LedTaskStatus;
  statusName: string;
  estimatedHours: number;
  /** yyyy-MM-dd, or null when the task has no due date. */
  dueDate: string | null;
  projectId: string;
  projectName: string;
  objectiveId: string;
  objectiveTitle: string;
  assignees: LedTaskAssigneeRef[];
  isShared: boolean;
}

export type LedTaskPage = LedPage<LedTaskRow>;

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

export interface LedTaskQuery {
  pageNumber: number;
  pageSize: number;
  /** Due-date window; omitted (or "all") means no window. */
  period?: LedProgressPeriod;
  search?: string;
  status?: LedTaskStatus;
  projectId?: string;
  objectiveId?: string;
  employeeId?: string;
  sort: LedTaskSort;
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
