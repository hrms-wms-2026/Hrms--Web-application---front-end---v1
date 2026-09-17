/**
 * Clock-in Policy API models aligned with backend contracts:
 * - ClockInPolicyListItemResponse / ClockInPolicyResponse (Application DTOs)
 * - UpsertClockInPolicyRequest (Api Contracts)
 *
 * Work-mode/clock-in-method configuration (Onsite/Remote/Hybrid/Field toggles,
 * location verification) lives in the separate WorkMode model/API — see
 * ../models/work-mode.model.ts and ../state/work-mode.store.ts. This model
 * covers only policy scope, effective dates, corrections, and late deduction
 * rules.
 */

export type ClockInPolicyScopeType = 'full_company' | 'department' | 'position' | 'employee';

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
  readonly correctionRequiresApproval: boolean;
  readonly notificationRecipientResolver: string;
  readonly lateDeductionRules: readonly {
    readonly lateArrivalMinute: number;
    readonly multiplier: number;
    readonly timeOffTypeId: string;
  }[];
  readonly isActive: boolean;
}
