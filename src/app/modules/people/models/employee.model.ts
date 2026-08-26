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
  readonly probationEndDate: string | null;
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

export interface ChangePositionPayload {
  readonly positionId: string;
  readonly effectiveFrom: string;
  readonly changeReason: 'Promotion' | 'Transfer' | 'LateralMove';
  readonly reportsToEmployeeId?: string | null;
}

export interface ChangePositionResponse {
  readonly pendingApproval: boolean;
}
