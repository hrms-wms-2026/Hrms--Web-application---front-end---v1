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
}

export interface ChecklistTemplateTaskResponse {
  title: string;
  ownerType: string;
  assignedToId: string | null;
  dueOffsetDays: number;
  sequence: number;
  isRequired: boolean;
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
