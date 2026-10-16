/**
 * Matches backend EmployeeListItemResponse DTO
 * (HRMS-Backend-v1 src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/EmployeeListItemResponse.cs).
 * Also used for the employee detail view (GET /api/v1/employees/{id}) in this slice -
 * the detail route is a minimal read-only view, not the full section-by-section detail UI.
 */
export interface EmployeeListAttendanceSummaryResponse {
  readonly showNotClockedInWarning: boolean;
  readonly shouldHaveClockedIn: boolean;
  readonly hasClockedInToday: boolean;
  readonly workDate: string;
  readonly timezone: string;
  readonly scheduledStartTime: string | null;
  readonly warningLabel: string | null;
  readonly attendanceStatus?: string | null;
  readonly attendanceStatusLabel?: string | null;
  readonly attentionType?: string | null;
  readonly attentionSeverity?: string | null;
  readonly attentionLabel?: string | null;
  readonly breakUsedMinutes?: number;
  /** Open attendance alerts awaiting review (Inbox), for the "N open alerts" chip. */
  readonly openAlertCount?: number;
  readonly breakAllowanceMinutes?: number | null;
  readonly breakOverageMinutes?: number;
  readonly isOverBreakAllowance?: boolean;
}

export interface EmployeeListItemResponse {
  readonly id: string;
  readonly employeeNumber: string;
  readonly fullName: string;
  readonly email: string;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly positionId: string | null;
  readonly positionName: string | null;
  readonly legalEntityId: string | null;
  readonly legalEntityName: string | null;
  readonly employmentTypeLabel: string;
  readonly status: string;
  readonly reportingManagerId: string | null;
  readonly reportingManagerName: string | null;
  /** "pending" | "accepted" | "expired" | "revoked" | null (no invitation ever issued, or list read). */
  readonly invitationStatus?: string | null;
  readonly invitationExpiresAt?: string | null;
  readonly attendanceSummary?: EmployeeListAttendanceSummaryResponse | null;
  readonly workModeLabel?: string | null;
  readonly avatarFileId?: string | null;
  /** Position/manager come from a reserved (planned) seat of a still-pending invite. */
  readonly positionPending?: boolean;
}

/**
 * Matches backend EmployeeIdentityResponse DTO (GET /api/v1/employees/{id}/identity) - name and
 * avatar only, deliberately gated on nothing beyond authentication (unlike EmployeeListItemResponse
 * above, which requires employees:read). Use this for resolving any employee's display identity
 * elsewhere in the app (project owner, task assignee, ...), never the full employees:read record.
 */
export interface EmployeeIdentityResponse {
  readonly id: string;
  readonly name: string;
  readonly avatarFileId: string | null;
}

export interface ResendInvitationResponse {
  readonly expiresAt: string;
}

export interface EmployeeListPageResponse {
  readonly items: readonly EmployeeListItemResponse[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface EmployeeListParams {
  search?: string;
  departmentId?: string;
  legalEntityId?: string;
  page?: number;
  pageSize?: number;
  /** Exclude on-leave/suspended/offboarding/terminated/resigned employees - for picker-style
   * callers (e.g. calendar participants) where only someone who could actually attend belongs. */
  activeOnly?: boolean;
  positionId?: string;
  employmentType?: readonly string[];
  managerId?: string;
  sortBy?: EmployeeSortKey;
  sortDir?: SortDirection;
}

export type EmployeeSortKey = 'name' | 'employeeNumber' | 'position' | 'department' | 'employmentType' | 'manager';
export type SortDirection = 'asc' | 'desc';

export type BulkEmployeeActionOutcome = 'succeeded' | 'pendingApproval' | 'failed';

export interface BulkEmployeeActionItem {
  readonly employeeId: string;
  readonly outcome: BulkEmployeeActionOutcome;
  readonly reason: string | null;
}

export interface BulkEmployeeActionResponse {
  readonly items: readonly BulkEmployeeActionItem[];
  readonly succeeded: number;
  readonly pendingApproval: number;
  readonly failed: number;
}

export function toEmployeeBulkSummary(response: BulkEmployeeActionResponse): BulkResultSummary {
  return {
    ...response,
    items: response.items.map((item) => ({
      id: item.employeeId,
      outcome: item.outcome,
      reason: item.reason
    }))
  };
}

export interface BulkChangePositionPayload {
  readonly employeeIds: readonly string[];
  readonly positionId: string;
  readonly effectiveFrom: string;
  readonly changeReason: 'Promotion' | 'Transfer';
  readonly reportsToEmployeeId: string | null;
}

export interface BulkChangeEmploymentTypePayload {
  readonly employeeIds: readonly string[];
  readonly employmentTypeCode: string;
}

export interface BulkStartOffboardingPayload {
  readonly employeeIds: readonly string[];
  readonly reason: string;
  readonly lastWorkingDate: string;
  readonly knowledgeRiskLevel: string;
  readonly rehireEligibility: string | null;
  readonly notes: string | null;
}

export interface EmployeeDetailResponse {
  readonly id: string;
  readonly jobInformation: EmployeeDetailJobInformation;
  readonly personalInformation: EmployeeDetailPersonalInformation;
  readonly emergencyContacts: readonly EmployeeDetailEmergencyContact[];
  readonly payroll: EmployeeDetailPayroll | null;
  readonly invitationStatus: string | null;
  readonly invitationExpiresAt: string | null;
  readonly trayAppAccessEnabled: boolean;
  readonly attendanceSummary?: EmployeeListAttendanceSummaryResponse | null;
}

export interface EmployeeDetailJobInformation {
  readonly employeeNumber: string;
  readonly legalEntityId: string | null;
  readonly legalEntityName: string | null;
  readonly departmentName: string | null;
  readonly positionName: string | null;
  readonly positionId: string | null;
  readonly reportingManagerName: string | null;
  readonly employmentTypeLabel: string;
  readonly status: string;
  readonly hireDate: string;
  readonly terminationDate?: string | null;
  readonly probationEndDate: string | null;
  readonly workModeLabel: string | null;
  readonly employmentTypeCode: string;
  readonly workModeId: string | null;
  /** Absent on an API built before the field was added. */
  readonly reportingManagerId?: string | null;
  /** Position reserved by a still-pending onboarding invite; becomes positionName once accepted. */
  readonly pendingPositionName?: string | null;
}

export interface EmployeeDetailPersonalInformation {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly nationalityId: string | null;
  readonly addresses: readonly EmployeeDetailAddress[];
}

export interface EmployeeDetailAddress {
  readonly id: string;
  readonly addressType: string;
  readonly addressJson: string;
  readonly isPrimary: boolean;
}

export interface EmployeeDetailEmergencyContact {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly email: string | null;
  readonly isPrimary: boolean;
}

export interface EmployeeDetailPayroll {
  readonly hasBankDetailsOnFile: boolean;
  readonly bankName: string | null;
  readonly maskedAccountNumber: string | null;
  readonly accountType: string | null;
}

export interface EmployeeBankDetailsRevealResponse {
  readonly bankName: string;
  readonly branchName: string;
  readonly accountHolderName: string;
  readonly accountNumber: string;
  readonly accountType: string;
  readonly routingNumber: string | null;
}

export interface ChangePositionPayload {
  readonly positionId: string;
  readonly effectiveFrom: string;
  readonly changeReason: 'Promotion' | 'Transfer' | 'LateralMove';
  readonly reportsToEmployeeId?: string | null;
}

export interface ChangePositionResponse {
  readonly pendingApproval: boolean;
}

export interface UpdateEmployeeJobDetailsRequest {
  readonly employeeNumber: string;
  readonly employmentTypeCode: string;
  readonly workModeId: string | null;
}
import { BulkResultSummary } from '../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';

