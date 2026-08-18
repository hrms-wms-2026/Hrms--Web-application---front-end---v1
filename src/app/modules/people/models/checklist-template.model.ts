import { ChecklistTaskCategory } from './offboarding.model';

export type ChecklistTemplateType = 'onboarding' | 'offboarding';

export type ChecklistTaskOwnerType = 'employee' | 'manager' | 'hr' | 'it' | 'custom_user';

/** UI-only task assignee choice — mapped to backend ownerType/assignee fields on submit. */
export type ChecklistTaskAssignmentType = 'employee' | 'company_position';

export type ChecklistTemplateScopeLevel = 'company' | 'department' | 'position';

export interface ChecklistTemplateTaskRequest {
  title: string;
  ownerType: ChecklistTaskOwnerType;
  assignedToId?: string | null;
  assigneePositionId?: string | null;
  dueOffsetDays: number;
  sequence?: number | null;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
}

export interface ChecklistTemplateTaskResponse {
  title: string;
  ownerType: string;
  assignedToId: string | null;
  dueOffsetDays: number;
  sequence: number;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
}

export interface ChecklistTemplateListItemResponse {
  id: string;
  name: string;
  templateType: ChecklistTemplateType;
  legalEntityId: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  isActive: boolean;
  taskCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistTemplateDetailResponse {
  id: string;
  name: string;
  templateType: ChecklistTemplateType;
  legalEntityId: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  isActive: boolean;
  tasks: readonly ChecklistTemplateTaskResponse[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistTemplateListPageResponse {
  items: readonly ChecklistTemplateListItemResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateChecklistTemplateRequest {
  name: string;
  templateType: ChecklistTemplateType;
  legalEntityId: string;
  departmentId?: string | null;
  positionId?: string | null;
  tasks: readonly ChecklistTemplateTaskRequest[];
}

export interface UpdateChecklistTemplateRequest {
  name: string;
  departmentId?: string | null;
  positionId?: string | null;
  tasks: readonly ChecklistTemplateTaskRequest[];
}

export interface ChecklistTemplateListParams {
  templateType?: ChecklistTemplateType;
  legalEntityId: string;
  departmentId?: string;
  positionId?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export type ChecklistTemplateMatchLevel = 'company' | 'department' | 'position';

export interface OnboardingChecklistTemplateMatchResponse {
  id: string;
  name: string;
  matchLevel: ChecklistTemplateMatchLevel;
  departmentId: string | null;
  positionId: string | null;
}

/** UI-only assignee choice for a draft-local task row in the Add Employee wizard. */
export type DraftTaskAssignee = 'employee' | 'another';

/**
 * Employee-specific, editable copy of a checklist task living only in the onboarding draft
 * (never written back to the checklist template). Serialized to the backend's EditedTasksJson
 * contract (see ChecklistTaskJsonContract.Parse, AbsoluteDate mode) on save.
 */
export interface DraftChecklistTask {
  readonly clientId: string;
  readonly title: string;
  readonly assignee: DraftTaskAssignee;
  /** Raw ownerType/assignedToId preserved from a template task already assigned to someone
   *  other than the employee. There is no picker to choose a new "another person" assignee, so
   *  this can only ever be carried over unchanged from the source template - never set fresh. */
  readonly preservedOwnerType: string | null;
  readonly preservedAssignedToId: string | null;
  readonly dueDays: number;
  readonly isRequired: boolean;
}
