/** Estimated-hours picture of a module (its whole subtree) or a sum of modules. Completed /
 * in progress / not started are task estimates by task state; untasked is the part of the
 * allocation not yet given to any task, overTasked how far task estimates exceed it. */
export interface LedHourTotals {
  allocatedHours: number;
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  untaskedHours: number;
  overTaskedHours: number;
  taskCount: number;
  /** Tasks with no estimate - they add no hours anywhere. */
  unestimatedTaskCount: number;
}

export interface LedModuleProgress {
  objectiveId: string;
  title: string;
  isRootModule: boolean;
  endDate: string;
  /** Null for a module the viewer leads directly; otherwise its parent (a child-module row). */
  parentObjectiveId: string | null;
  /** 0 for a led module, 1 for its children, and so on. */
  depth: number;
  /** Not-completed work past its due date somewhere in this module's subtree. */
  atRisk: boolean;
  hours: LedHourTotals;
}

export interface LedProjectProgress {
  projectId: string;
  projectName: string;
  identifier: string;
  hours: LedHourTotals;
  /** Led modules, each followed depth-first by its child modules. */
  modules: LedModuleProgress[];
}

export interface LedTaskAssignee {
  employeeId: string;
  displayName: string;
}

export interface LedOverdueTask {
  taskId: string;
  shortId: string;
  title: string;
  projectId: string;
  objectiveId: string;
  dueDate: string;
  daysOverdue: number;
  assignees: LedTaskAssignee[];
}

export interface LedWorkProgressResponse {
  hours: LedHourTotals;
  projects: LedProjectProgress[];
  overdueTasks: LedOverdueTask[];
  overdueTotal: number;
  /** Led modules whose subtree has overdue work. */
  modulesAtRisk: number;
}
