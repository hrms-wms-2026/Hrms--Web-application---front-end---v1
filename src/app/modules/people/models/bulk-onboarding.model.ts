/**
 * Matches backend Contracts (HRMS-Backend-v1 src/ONEVO.Api/Contracts/CoreHr/BulkOnboarding/*).
 * See docs/superpowers/specs/2026-08-18-bulk-employee-onboarding-frontend-design.md.
 */

export type BulkOnboardingBatchStatus =
  | 'mapping_pending'
  | 'validated'
  | 'draft_creation_pending'
  | 'drafts_created'
  | 'finalize_pending'
  | 'finalize_completed';

export type BulkOnboardingRowStatus =
  | 'pending_mapping'
  | 'valid'
  | 'invalid'
  | 'draft_created'
  | 'draft_failed'
  | 'finalized'
  | 'waiting_for_seat'
  | 'waiting_for_position_approval'
  | 'finalize_failed';

/** System field ids the mapping UI offers - keys of BulkOnboardingColumnMapping. */
export type BulkOnboardingSystemField =
  | 'firstName'
  | 'lastName'
  | 'workEmail'
  | 'startDate'
  | 'employmentType'
  | 'workMode'
  | 'department'
  | 'position'
  | 'checklistTemplate'
  | 'employeeNumber';

export type BulkOnboardingColumnMapping = Partial<Record<BulkOnboardingSystemField, string | null>>;

export interface UploadBulkOnboardingBatchPayload {
  file: File;
  legalEntityId: string;
  defaultWorkModeId: number | null;
  defaultEmploymentType: string | null;
  defaultChecklistTemplateId: string | null;
}

export interface BulkOnboardingBatchResponse {
  readonly id: string;
  readonly status: BulkOnboardingBatchStatus;
  readonly totalRows: number;
  readonly validRows: number | null;
  readonly invalidRows: number | null;
  readonly detectedColumns: readonly string[];
  readonly suggestedMapping: BulkOnboardingColumnMapping;
}

export interface RowPreviewResponse {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly workEmail: string | null;
  readonly startDate: string | null;
  readonly employmentType: string | null;
  readonly workModeName: string | null;
  readonly departmentName: string | null;
  readonly positionName: string | null;
  readonly checklistTemplateName: string | null;
  readonly employeeNumber: string | null;
}

export interface RowValidationResultItem {
  readonly rowNumber: number;
  readonly status: BulkOnboardingRowStatus;
  readonly errorMessage: string | null;
}

export interface ValidateBulkOnboardingBatchResponse {
  readonly validRows: number;
  readonly invalidRows: number;
  readonly rows: readonly RowValidationResultItem[];
}

export interface BulkOnboardingBatchRowDetail {
  readonly rowNumber: number;
  readonly status: BulkOnboardingRowStatus;
  readonly errorMessage: string | null;
  readonly onboardingDraftId: string | null;
}

export interface BulkOnboardingBatchDetailResponse {
  readonly id: string;
  readonly status: BulkOnboardingBatchStatus;
  readonly totalRows: number;
  readonly validRows: number | null;
  readonly invalidRows: number | null;
  readonly rows: readonly BulkOnboardingBatchRowDetail[];
}

export const BULK_ONBOARDING_SYSTEM_FIELD_LABELS: Record<BulkOnboardingSystemField, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  workEmail: 'Work Email',
  startDate: 'Start Date',
  employmentType: 'Employment Type',
  workMode: 'Work Mode',
  department: 'Department',
  position: 'Position',
  checklistTemplate: 'Checklist Template',
  employeeNumber: 'Employee Number'
};
