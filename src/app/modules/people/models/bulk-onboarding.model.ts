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
  | 'employeeNumber'
  | 'reportingManager';

export type BulkOnboardingColumnMapping = Partial<Record<BulkOnboardingSystemField, string | null>>;

export type BulkOnboardingIssueAction =
  | 'map_existing'
  | 'edit_imported_value'
  | 'create_department'
  | 'create_position'
  | 'set_default'
  | 'increase_capacity';

export interface UploadBulkOnboardingBatchPayload {
  file: File;
  legalEntityId: string;
  defaultWorkModeId: string | null;
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

export interface BulkOnboardingRowError {
  readonly code: string;
  readonly field: string;
  readonly message: string;
  readonly importedValue: string | null;
}

export interface RowValidationResultItem {
  readonly rowNumber: number;
  readonly status: BulkOnboardingRowStatus;
  readonly errorMessage: string | null;
  readonly errors?: readonly BulkOnboardingRowError[];
}

export interface BulkOnboardingIssueSuggestion {
  readonly id: string;
  readonly label: string;
  readonly confidence: string;
}

export interface BulkOnboardingIssueContext {
  readonly positionId: string | null;
  readonly positionName: string | null;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly maxOccupancy: number | null;
  readonly currentPrimaryAssignments: number | null;
  readonly availableSeats: number | null;
  readonly requiredSeatsInBatch: number | null;
  readonly canIncreaseCapacity: boolean;
}

export interface BulkOnboardingGroupedIssue {
  readonly issueKey: string;
  readonly issueType: string;
  readonly field: string;
  readonly importedValue: string | null;
  readonly affectedRowNumbers: readonly number[];
  readonly affectedRowCount: number;
  readonly suggestions: readonly BulkOnboardingIssueSuggestion[];
  readonly allowedActions: readonly BulkOnboardingIssueAction[];
  readonly context?: BulkOnboardingIssueContext | null;
}

export interface ValidateBulkOnboardingBatchResponse {
  readonly validRows: number;
  readonly invalidRows: number;
  readonly totalRows?: number;
  readonly rows: readonly RowValidationResultItem[];
  readonly issues?: readonly BulkOnboardingGroupedIssue[];
}

export interface ResolveBulkOnboardingIssuesPayload {
  readonly issueKey: string;
  readonly action: BulkOnboardingIssueAction;
  readonly targetId?: string | null;
  readonly newValue?: string | null;
  readonly workModeId?: string | null;
  readonly applyToRowNumbers?: readonly number[] | null;
  readonly create?: {
    readonly name: string;
    readonly code?: string | null;
    readonly parentDepartmentId?: string | null;
  } | null;
  readonly createPosition?: {
    readonly departmentId: string;
    readonly name: string;
    readonly code: string;
    readonly capacity: number;
    readonly reportsToPositionId?: string | null;
  } | null;
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
  employeeNumber: 'Employee Number',
  reportingManager: 'Reporting Manager'
};

export const BULK_ONBOARDING_ISSUE_TYPE_LABELS: Record<string, string> = {
  department_not_found: 'Department not found',
  position_not_found: 'Position not found',
  position_capacity_exceeded: 'Not enough seats',
  work_mode_missing: 'Missing work mode',
  work_mode_not_found: 'Work mode not found',
  employment_type_not_found: 'Employment type not found',
  employment_type_missing: 'Missing employment type',
  checklist_template_not_found: 'Checklist template not found',
  duplicate_work_email: 'Duplicate work email',
  duplicate_employee_number: 'Duplicate employee number',
  invalid_start_date: 'Invalid start date',
  missing_first_name: 'Missing first name',
  missing_last_name: 'Missing last name',
  missing_work_email: 'Missing work email',
  reporting_manager_required: 'Reporting manager required',
  reporting_manager_not_found: 'Reporting manager not found'
};
