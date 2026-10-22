/** One policy = one leave type. Rules live on dated versions; assignments say who it applies to. */
export type LeaveAmountPeriod = 'month' | 'year';
export type LeaveEligibility = 'immediately' | 'after_probation' | 'after_months';
export type LeavePolicyApprovalMode = 'any_one' | 'all_must_approve' | 'in_order' | 'none';
export type LeavePolicyTargetKind = 'legal_entity' | 'department' | 'position' | 'employee';

export interface LeavePolicyBlackout {
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string | null;
}

/** Every rule of one version. Amounts are hours; notice is days. */
export interface LeavePolicyRules {
  readonly amountHours: number;
  readonly amountPeriod: LeaveAmountPeriod;
  readonly carryForwardCapHours: number | null;
  readonly carryForwardExpiryMonths: number | null;
  readonly eligibleFrom: LeaveEligibility;
  readonly eligibleAfterMonths: number | null;
  readonly minimumNoticeDays: number;
  readonly minRequestHours: number;
  readonly maxRequestHours: number | null;
  readonly maxTeamAbsencePercent: number | null;
  readonly approvalMode: LeavePolicyApprovalMode;
  readonly blackouts: readonly LeavePolicyBlackout[];
}

export interface LeavePolicyAssignmentTarget {
  readonly targetKind: LeavePolicyTargetKind;
  readonly targetId: string;
}

export interface LeavePolicyListItem {
  readonly id: string;
  readonly name: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeColor: string;
  readonly amountHours: number;
  readonly amountPeriod: LeaveAmountPeriod;
  readonly currentVersionNumber: number;
  readonly nextVersionEffectiveFrom: string | null;
  readonly assignmentCount: number;
  readonly assignedToSummary: readonly string[];
  readonly isActive: boolean;
}

export interface LeavePolicyVersion extends LeavePolicyRules {
  readonly id: string;
  readonly versionNumber: number;
  readonly effectiveFrom: string;
  readonly isCurrent: boolean;
  readonly isFuture: boolean;
  readonly createdAt: string;
  readonly createdByName: string | null;
}

export interface LeavePolicyAssignment extends LeavePolicyAssignmentTarget {
  readonly id: string;
  readonly targetName: string;
  readonly effectiveFrom: string;
}

export interface LeavePolicyDetail {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeColor: string;
  readonly isActive: boolean;
  readonly current: LeavePolicyVersion;
  readonly versions: readonly LeavePolicyVersion[];
  readonly assignments: readonly LeavePolicyAssignment[];
}

export interface CreateLeavePolicyRequest {
  readonly leaveTypeId: string;
  readonly name: string;
  readonly description: string | null;
  readonly rules: LeavePolicyRules;
  readonly assignments: readonly LeavePolicyAssignmentTarget[];
  readonly replaceConflicts: boolean;
}

export interface AddLeavePolicyVersionRequest {
  readonly applyFrom: string;
  readonly rules: LeavePolicyRules;
}

export interface UpdateLeavePolicyDetailsRequest {
  readonly name: string;
  readonly description: string | null;
}

export interface LeavePolicyAssignmentConflict extends LeavePolicyAssignmentTarget {
  readonly targetName: string;
  readonly existingPolicyId: string;
  readonly existingPolicyName: string;
}

/** Thrown by the API service when the server answers 409 with targets that already have another
 * policy for the same leave type. Resend with replaceConflicts = true after the user confirms. */
export class LeavePolicyConflictError extends Error {
  constructor(readonly conflicts: readonly LeavePolicyAssignmentConflict[]) {
    super('Some targets already have a policy for this leave type.');
  }
}

/** One row per active leave type on the employee screen. */
export interface EmployeeLeavePolicyRow {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeColor: string;
  readonly policyId: string | null;
  readonly policyName: string | null;
  readonly sourceKind: LeavePolicyTargetKind | null;
  readonly sourceName: string | null;
  readonly amountHours: number | null;
  readonly amountPeriod: LeaveAmountPeriod | null;
  readonly isOverride: boolean;
}

export const LEAVE_POLICY_APPROVAL_MODE_OPTIONS = [
  { value: 'any_one', label: 'Any one approver' },
  { value: 'all_must_approve', label: 'All approvers' },
  { value: 'in_order', label: 'Approvers in order' },
  { value: 'none', label: 'No approval needed' }
] as const;

export const LEAVE_AMOUNT_PERIOD_OPTIONS = [
  { value: 'month', label: 'month' },
  { value: 'year', label: 'year' }
] as const;

export const LEAVE_ELIGIBILITY_OPTIONS = [
  { value: 'immediately', label: 'Right away' },
  { value: 'after_probation', label: 'After probation' },
  { value: 'after_months', label: 'After a number of months' }
] as const;

export const LEAVE_POLICY_SOURCE_LABELS: Readonly<Record<LeavePolicyTargetKind, string>> = {
  employee: 'Employee',
  position: 'Position',
  department: 'Department',
  legal_entity: 'Company'
};
