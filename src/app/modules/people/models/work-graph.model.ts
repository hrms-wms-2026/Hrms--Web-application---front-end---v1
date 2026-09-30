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
