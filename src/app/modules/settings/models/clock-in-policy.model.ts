/**
 * Clock-in Policy API models aligned with backend contracts:
 * - ClockInPolicyListItemResponse / ClockInPolicyResponse (Application DTOs)
 * - UpsertClockInPolicyRequest (Api Contracts)
 *
 * Product language uses Hybrid for the hybrid work area. Backend persistence may
 * use internal either_* columns; those names must not appear in UI.
 */

export type ClockInPolicyScopeType = 'full_company' | 'department' | 'position' | 'employee';

export type HybridSourceRule = 'onsite' | 'remote' | 'employee_choice';

export type FieldPhotoRequirement = 'off' | 'optional' | 'required';

export interface ClockInPolicyListItemResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly scopeType: ClockInPolicyScopeType;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly isActive: boolean;
  readonly lateDeductionRuleCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClockInPolicyScope {
  readonly type: ClockInPolicyScopeType;
  readonly departmentIds: readonly string[];
  readonly positionIds: readonly string[];
  readonly employeeIds: readonly string[];
}

export interface WorkAreaSourceRules {
  readonly biometricEnabled: boolean;
  readonly webEnabled: boolean;
  readonly trayEnabled: boolean;
  readonly photoRequired: boolean;
}

export interface HybridWorkAreaRules {
  readonly biometricEnabled: boolean;
  readonly webEnabled: boolean;
  readonly trayEnabled: boolean;
  readonly photoRequired: boolean;
  readonly locationCheckRequired: boolean;
  readonly sourceRule: HybridSourceRule;
}

export interface FieldWorkAreaRules {
  readonly biometricEnabled: boolean;
  readonly webEnabled: boolean;
  readonly trayEnabled: boolean;
  readonly photoRequirement: FieldPhotoRequirement;
}

export interface WorkAreaRules {
  readonly onsite: WorkAreaSourceRules;
  readonly remote: WorkAreaSourceRules;
  readonly hybrid: HybridWorkAreaRules;
  readonly field: FieldWorkAreaRules;
}

export interface LateDeductionRule {
  readonly id?: string;
  readonly lateArrivalMinute: number;
  readonly multiplier: number;
  readonly timeOffTypeId: string;
  readonly isActive?: boolean;
}

export interface ClockInPolicyResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly scope: ClockInPolicyScope;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly locationVerificationRequired: boolean;
  readonly allowedRadiusMeters: number | null;
  readonly workAreaRules: WorkAreaRules;
  readonly correctionRequiresApproval: boolean;
  readonly notificationRecipientResolver: string;
  readonly lateDeductionRules: readonly LateDeductionRule[];
  readonly isActive: boolean;
  readonly createdById: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpsertClockInPolicyRequest {
  readonly name: string;
  readonly scope: ClockInPolicyScope;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly locationVerificationRequired: boolean;
  readonly allowedRadiusMeters: number | null;
  readonly workAreaRules: WorkAreaRules;
  readonly correctionRequiresApproval: boolean;
  readonly notificationRecipientResolver: string;
  readonly lateDeductionRules: readonly {
    readonly lateArrivalMinute: number;
    readonly multiplier: number;
    readonly timeOffTypeId: string;
  }[];
  readonly isActive: boolean;
}
