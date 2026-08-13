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
  readonly positionId: string | null;
  readonly employmentType: string;
  readonly startDate: string;
  readonly employeeNumber: string | null;
  readonly workModeId: number;
  readonly selectedTemplateId: string | null;
  readonly editedTasksJson: string | null;
  readonly status: DraftStatus;
  readonly draftReason: DraftReason | null;
  readonly lastSavedStep: WizardStep;
  readonly startedById: string;
  /** Opaque xmin-derived version string. Send back as If-Match on update. */
  readonly version: string;
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
}

export type DraftStatus = 'draft' | 'waiting_for_seat' | 'waiting_for_position_approval' | 'cancelled' | 'finalized';

export type DraftReason =
  | 'saved_manually'
  | 'waiting_for_seat'
  | 'waiting_for_position_approval'
  | 'position_approval_rejected'
  | 'seat_configuration_required'
  | 'invitation_sent';

export type WizardStep = 'employee_details' | 'checklist_template' | 'checklist_review' | 'review_and_submit';

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
  waiting_for_seat: 'Draft – waiting for seat',
  waiting_for_position_approval: 'Draft – waiting for approval',
  cancelled: 'Cancelled',
  finalized: 'Finalized'
};

export interface SaveOnboardingDraftPayload {
  draftId?: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  legalEntityId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentType: string;
  startDate: string;
  employeeNumber: string | null;
  workModeId: number;
  selectedTemplateId: string | null;
  editedTasksJson: string | null;
  lastSavedStep: WizardStep;
}

export interface WorkModeOption {
  readonly id: number;
  readonly code: string;
  readonly label: string;
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
