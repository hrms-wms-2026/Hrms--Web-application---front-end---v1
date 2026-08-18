export type OffboardingReason = 'resignation' | 'termination' | 'retirement' | 'contract_end';
export type RehireEligibility = 'eligible' | 'not_eligible' | 'conditional';
export type KnowledgeRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type OffboardingRecordStatus = 'initiated' | 'in_progress' | 'completed' | 'cancelled';
export type EmployeeChecklistTaskStatus = 'pending' | 'in_progress' | 'completed' | 'bypassed';
export type ChecklistTaskCategory =
  | 'asset_return' | 'access_removal' | 'document_handover' | 'final_settlement' | 'knowledge_handover' | 'other';
export type BypassRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ChecklistTemplateMatchLevel = 'position' | 'department' | 'company';

export interface StartOffboardingRequest {
  reason: OffboardingReason;
  lastWorkingDate: string;
  knowledgeRiskLevel: KnowledgeRiskLevel;
  rehireEligibility: RehireEligibility | null;
  notes: string | null;
}

export interface OffboardingRecordResponse {
  id: string;
  employeeId: string;
  reason: OffboardingReason;
  lastWorkingDate: string;
  knowledgeRiskLevel: KnowledgeRiskLevel;
  rehireEligibility: RehireEligibility | null;
  notes: string | null;
  checklistTemplateId: string | null;
  status: OffboardingRecordStatus;
  createdAt: string;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface ChecklistTemplateMatchResponse {
  id: string;
  name: string;
  matchLevel: ChecklistTemplateMatchLevel;
}

export interface EmployeeChecklistTaskResponse {
  id: string;
  taskTitle: string;
  ownerType: string;
  assignedToId: string;
  dueDate: string;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
  status: EmployeeChecklistTaskStatus;
  completedAt: string | null;
}

export interface UpdateEmployeeChecklistTaskRequest {
  assignedToId: string;
  dueDate: string;
  isRequired: boolean;
}

export interface CreateBypassRequestRequest {
  approverId: string;
  bypassReason: string;
  penaltyDescription: string | null;
}

export interface BypassRequestResponse {
  id: string;
  employeeChecklistTaskId: string;
  offboardingRecordId: string;
  requestedById: string;
  bypassReason: string;
  penaltyDescription: string | null;
  status: BypassRequestStatus;
  requestedAt: string;
}
