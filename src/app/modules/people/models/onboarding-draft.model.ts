/**
 * Matches backend OnboardingDraftResponse DTO
 * (HRMS-Backend-v1 src/ONEVO.Application/Features/CoreHr/OnboardingDraft/DTOs/Responses/OnboardingDraftResponse.cs).
 * Used to populate the wizard when creating/resuming a draft - carries raw IDs (not names) so
 * dropdowns can be re-selected/re-validated against live department/position API calls.
 */
export interface OnboardingDraftResponse {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly workEmail: string;
  readonly legalEntityId: string;
  readonly departmentId: string | null;
  readonly departmentName?: string | null;
  readonly positionId: string | null;
  readonly positionName?: string | null;
  readonly employmentType: string;
  readonly startDate: string | null;
  readonly employeeNumber: string | null;
  readonly workModeId: string | null;
  readonly workModeLabel?: string | null;
  readonly selectedTemplateId: string | null;
  readonly editedTasksJson: string | null;
  readonly status: DraftStatus;
  readonly draftReason: DraftReason | null;
  readonly lastSavedStep: WizardStep;
  readonly startedById: string;
  readonly reportsToEmployeeId: string | null;
  readonly reportingManagerName?: string | null;
  readonly reportingManagerPositionName?: string | null;
  /** Per-employee clock-in evidence overrides; null = inherit from the work mode / policy. */
  readonly photoRequiredOverride?: boolean | null;
  readonly locationCaptureOverride?: boolean | null;
  /** Uploaded (not yet linked) employee_avatar file chosen on the Identity step. */
  readonly avatarFileId?: string | null;
  /** Opaque xmin-derived version string. Send back as If-Match on update. */
  readonly version: string;
}

/** Active PrimaryEmployment holder of a position's reporting target — used by the reports-to picker. */
export interface ActiveHolder {
  readonly employeeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly workEmail: string;
  readonly avatarFileId: string | null;
  readonly departmentName?: string | null;
}

/** Anyone with an active seat in the company (backend ManagerCandidateResponse) - the
 *  Reporting step's "Choose someone else" search, for a one-off manager from any line. */
export interface ManagerCandidate {
  readonly employeeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly positionId: string;
  readonly positionName: string;
  readonly departmentName: string | null;
}

/**
 * Matches backend DraftListItemResponse DTO
 * (HRMS-Backend-v1 .../DTOs/Responses/DraftListItemResponse.cs) - the list-view shape with
 * resolved names, distinct from OnboardingDraftResponse which carries raw IDs for the wizard.
 */
export interface DraftListItemResponse {
  readonly id: string;
  readonly displayName: string;
  readonly positionName: string | null;
  readonly departmentName: string | null;
  readonly status: DraftStatus;
  readonly draftReason: DraftReason | null;
  readonly lastSavedStep: WizardStep;
  readonly startedByName: string;
}

export interface DraftListPageResponse {
  readonly items: readonly DraftListItemResponse[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface DraftListParams {
  page?: number;
  pageSize?: number;
  /** Only the caller's own open drafts (excludes cancelled, finalized and invitation-sent). */
  mine?: boolean;
}

export type DraftStatus = 'draft' | 'waiting_for_seat' | 'waiting_for_position_approval' | 'cancelled' | 'finalized';

export type DraftReason =
  | 'saved_manually'
  | 'waiting_for_seat'
  | 'waiting_for_position_approval'
  | 'position_approval_rejected'
  | 'seat_configuration_required'
  | 'invitation_sent';

export type WizardStep =
  | 'employee_details'
  | 'reporting'
  | 'work_setup'
  | 'checklist_template'
  | 'checklist_review'
  | 'review_and_submit';

/** Maps backend draft_reason codes to the safe display copy - never render the raw code. */
export const DRAFT_REASON_LABELS: Record<DraftReason, string> = {
  saved_manually: 'Saved manually',
  waiting_for_seat: 'Waiting for seat',
  waiting_for_position_approval: 'Waiting for position approval',
  position_approval_rejected: 'Position approval rejected',
  seat_configuration_required: 'Seat configuration required',
  invitation_sent: 'Invitation sent'
};

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  draft: 'Draft',
  waiting_for_seat: 'Draft',
  waiting_for_position_approval: 'Draft',
  cancelled: 'Cancelled',
  finalized: 'Finalized'
};

export interface SaveOnboardingDraftPayload {
  draftId?: string;
  /** Saving is lenient: everything but the company may be blank (null). Finalize enforces the rest. */
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  legalEntityId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentType: string | null;
  startDate: string | null;
  employeeNumber: string | null;
  workModeId: string | null;
  selectedTemplateId: string | null;
  editedTasksJson: string | null;
  lastSavedStep: WizardStep;
  reportsToEmployeeId?: string | null;
  photoRequiredOverride?: boolean | null;
  locationCaptureOverride?: boolean | null;
  avatarFileId?: string | null;
}

export interface WorkModeOption {
  readonly id: string;
  readonly label: string;
  readonly photoRequired?: boolean;
  readonly selfRegistersLocation?: boolean;
  readonly allowsDailyLocationChoice?: boolean;
}

/** One person in the chosen manager's reporting chain (backend ReportingChainNodeResponse). */
export interface ReportingChainNode {
  /** Null for a vacant position in the line. */
  readonly employeeId: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly positionName: string | null;
  readonly departmentName: string | null;
  readonly kind?: 'person' | 'vacant';
  /** "position" | "default" | "custom" - how this step links to the one above it. */
  readonly reportingLine?: string | null;
}

/** Clock-in evidence a new employee would inherit (backend OnboardingClockInDefaultsResponse). */
export interface ClockInDefaults {
  readonly photoRequired: boolean;
  readonly locationCapture: boolean;
}

export interface FinalizeOnboardingDraftResponse {
  readonly draftId: string;
  readonly employeeId: string | null;
  readonly status: string;
  readonly draftReason: string | null;
  readonly invitationQueued: boolean;
  readonly positionApprovalPending: boolean;
  readonly checklistTasksCreated: boolean;
  readonly messageKey: string;
}

export interface ApproveAccessGrantRequestResponse {
  readonly accessGrantRequestId: string;
  readonly onboardingDraftId: string;
  readonly employeeId: string;
  readonly finalizationStatus: string;
  readonly invitationQueued: boolean;
  readonly checklistTaskCount: number;
  readonly positionApprovalStatus: string;
  readonly messageKey: string;
}

export interface RejectAccessGrantRequestRequest {
  decisionNote?: string | null;
}

export interface RejectAccessGrantRequestResponse {
  readonly accessGrantRequestId: string;
  readonly onboardingDraftId: string;
  readonly requestStatus: string;
  readonly draftStatus: string;
  readonly draftReason: string | null;
  readonly messageKey: string;
}

/** GET /api/v1/onboarding/employee-number-suggestion */
export interface EmployeeNumberSuggestionResponse {
  readonly employeeNumber: string;
  readonly prefix: string;
  readonly sequence: number;
}

/** GET /api/v1/onboarding/employee-number-availability — live hint only; save/finalize re-check. */
export interface EmployeeNumberAvailabilityResponse {
  readonly employeeNumber: string;
  readonly available: boolean;
}
