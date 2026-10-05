export type WorkGraphNodeKind = 'employee' | 'project' | 'module' | 'task';
export type WorkGraphModuleRole = 'owner' | 'member' | 'contributor';
export type WorkGraphTaskStatus = 'not_started' | 'active';
export type WorkGraphLinkKind = 'works_on' | 'contains' | 'owns' | 'member_of' | 'has_task';

export interface WorkGraphNode {
  readonly id: string;
  readonly kind: WorkGraphNodeKind;
  readonly label: string;
  readonly sublabel?: string | null;
  readonly role?: WorkGraphModuleRole | null;
  readonly status?: WorkGraphTaskStatus | null;
  readonly projectId?: string | null;
  readonly objectiveId?: string | null;
  readonly taskId?: string | null;
  /** Projects and modules: whole-project/module numbers, not just this employee's tasks. */
  readonly stats?: WorkGraphStats | null;
  /** Modules only. */
  readonly module?: WorkGraphModuleDetails | null;
  /** Tasks only (this employee's open tasks). */
  readonly task?: WorkGraphTaskDetails | null;
  /** Projects only: the cover image, served by GET /work/projects/{id}/logo. */
  readonly logoFileId?: string | null;
}

/** Top-level task counts by status; progress follows Work Management (completed / allocated hours). */
export interface WorkGraphStats {
  readonly totalTasks: number;
  readonly notStarted: number;
  readonly inProgress: number;
  readonly completed: number;
  readonly overdue: number;
  readonly allocatedHours: number;
  readonly completedHours: number;
}

export interface WorkGraphPerson {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
}

export interface WorkGraphModuleDetails {
  readonly owner: WorkGraphPerson | null;
  readonly startDate: string;
  readonly endDate: string;
  /** Capped list (earliest joiners first); memberCount is the full count. */
  readonly members: readonly WorkGraphPerson[];
  readonly memberCount: number;
}

export interface WorkGraphTaskDetails {
  readonly dueDate: string | null;
  readonly statusName: string | null;
  readonly priority: string | null;
  readonly isOverdue: boolean;
}

export interface WorkGraphLink {
  readonly source: string;
  readonly target: string;
  readonly kind: WorkGraphLinkKind;
}

/** Mirrors HRMS-Backend-v1 EmployeeWorkGraphResponse (GET /api/v1/employees/{id}/work-graph). */
export interface EmployeeWorkGraphResponse {
  readonly nodes: readonly WorkGraphNode[];
  readonly links: readonly WorkGraphLink[];
  readonly hiddenTaskCount: number;
}
