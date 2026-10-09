export interface LedWorkTotals {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

export interface LedModuleProgress {
  objectiveId: string;
  title: string;
  isRootModule: boolean;
  endDate: string;
  totals: LedWorkTotals;
}

export interface LedProjectProgress {
  projectId: string;
  projectName: string;
  identifier: string;
  totals: LedWorkTotals;
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
  totals: LedWorkTotals;
  projects: LedProjectProgress[];
  overdueTasks: LedOverdueTask[];
  overdueTotal: number;
}
