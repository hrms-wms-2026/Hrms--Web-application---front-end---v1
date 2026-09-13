import {
  ClockInPolicyResponse,
  UpsertClockInPolicyRequest,
  WorkAreaRules
} from '../models/clock-in-policy.model';

/** Local browser date as yyyy-MM-dd for Effective from default. */
export function todayLocalIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_POLICY_NAME = 'Default clock-in policy';

/**
 * Late deduction rules need a Time Off Type lookup for the dropdown.
 * Verified: no frontend Time Off Type API/service exists yet.
 * Keep editing disabled until a real lookup is wired — do not invent an endpoint.
 */
export const LATE_DEDUCTION_RULES_EDITABLE = false;

export const LATE_DEDUCTION_RULES_DISABLED_MESSAGE =
  'Time off types must be configured before late deduction rules can be added.';

export const DEFAULT_WORK_AREA_RULES: WorkAreaRules = {
  onsite: {
    biometricEnabled: true,
    webEnabled: false,
    trayEnabled: false,
    photoRequired: false
  },
  remote: {
    biometricEnabled: false,
    webEnabled: true,
    trayEnabled: true,
    photoRequired: true,
    locationCheckRequired: false
  },
  hybrid: {
    biometricEnabled: false,
    webEnabled: true,
    trayEnabled: true,
    photoRequired: true,
    locationCheckRequired: false,
    sourceRule: 'employee_choice'
  },
  field: {
    biometricEnabled: false,
    webEnabled: true,
    trayEnabled: true,
    photoRequirement: 'required'
  }
};

/** Editable late-deduction row (string fields for inputs). */
export interface LateDeductionRuleFormRow {
  lateArrivalMinutes: string;
  deductionAmount: string;
  timeOffTypeId: string;
}

/**
 * Company-wide settings form model (user-editable clock-in methods + late rules).
 * Name / effective dates are kept internally for upsert payloads — never shown in UI.
 * Hybrid "Allowed distance" maps to locationVerificationRequired + allowedRadiusMeters on save.
 */
export interface ClockInPolicySettingsFormValue {
  /** Internal — not rendered. */
  name: string;
  /** Internal — not rendered. */
  effectiveFrom: string;
  /** Internal — not rendered. Empty string maps to null on save. */
  effectiveTo: string;
  /** Hybrid "Allowed distance" value (meters). Used only when hybrid.locationCheckRequired. */
  allowedDistanceMeters: string;
  workAreaRules: WorkAreaRules;
  /** Late deduction rows — only submitted when LATE_DEDUCTION_RULES_EDITABLE is true. */
  lateDeductionRules: LateDeductionRuleFormRow[];
}

/** @deprecated Prefer ClockInPolicySettingsFormValue */
export type ClockInPolicyFormModel = ClockInPolicySettingsFormValue;

export function createEmptyLateDeductionRule(): LateDeductionRuleFormRow {
  return {
    lateArrivalMinutes: '',
    deductionAmount: '',
    timeOffTypeId: ''
  };
}

export function createDefaultClockInPolicyFormModel(now = new Date()): ClockInPolicySettingsFormValue {
  return {
    name: DEFAULT_POLICY_NAME,
    effectiveFrom: todayLocalIsoDate(now),
    effectiveTo: '',
    allowedDistanceMeters: '',
    workAreaRules: structuredClone(DEFAULT_WORK_AREA_RULES),
    lateDeductionRules: []
  };
}

function safePolicyName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  return trimmed || DEFAULT_POLICY_NAME;
}

function safeEffectiveFrom(value: string | null | undefined, now = new Date()): string {
  const trimmed = value?.trim().slice(0, 10) ?? '';
  return trimmed || todayLocalIsoDate(now);
}

function safeEffectiveTo(value: string | null | undefined): string {
  const trimmed = value?.trim().slice(0, 10) ?? '';
  return trimmed;
}

export function lateRulesFromPolicy(
  policy: ClockInPolicyResponse
): LateDeductionRuleFormRow[] {
  return policy.lateDeductionRules.map((r) => ({
    lateArrivalMinutes: String(r.lateArrivalMinute),
    deductionAmount: String(r.multiplier),
    timeOffTypeId: r.timeOffTypeId
  }));
}

export function formModelFromPolicy(
  policy: ClockInPolicyResponse,
  now = new Date(),
  lateRulesEditable = LATE_DEDUCTION_RULES_EDITABLE
): ClockInPolicySettingsFormValue {
  const fieldPhoto =
    policy.workAreaRules.field.photoRequirement === 'required' ? 'required' : 'off';

  const hybridLocationCheckRequired = policy.workAreaRules.hybrid.locationCheckRequired === true;
  const remoteLocationCheckRequired = policy.workAreaRules.remote.locationCheckRequired === true;
  const anyLocationCheckRequired = hybridLocationCheckRequired || remoteLocationCheckRequired;
  const allowedDistanceMeters =
    anyLocationCheckRequired &&
    policy.allowedRadiusMeters !== null &&
    policy.allowedRadiusMeters !== undefined
      ? String(policy.allowedRadiusMeters)
      : '';

  return {
    name: safePolicyName(policy.name),
    effectiveFrom: safeEffectiveFrom(policy.effectiveFrom, now),
    effectiveTo: safeEffectiveTo(policy.effectiveTo),
    allowedDistanceMeters,
    workAreaRules: {
      ...structuredClone(policy.workAreaRules),
      remote: {
        ...structuredClone(policy.workAreaRules.remote),
        locationCheckRequired: remoteLocationCheckRequired
      },
      hybrid: {
        ...structuredClone(policy.workAreaRules.hybrid),
        locationCheckRequired: hybridLocationCheckRequired,
        sourceRule: 'employee_choice'
      },
      field: {
        ...structuredClone(policy.workAreaRules.field),
        photoRequirement: fieldPhoto
      }
    },
    lateDeductionRules: lateRulesEditable ? lateRulesFromPolicy(policy) : []
  };
}

export interface FormValidationResult {
  readonly valid: boolean;
  readonly errors: Record<string, string>;
}

function isPositiveNumber(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

function isIntegerAtLeastOne(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1;
}

/**
 * Sort late rules by late arrival minutes ascending for payload submit.
 * Invalid / empty minutes sort last (validation should block submit first).
 */
export function sortLateDeductionRules(
  rules: readonly LateDeductionRuleFormRow[]
): LateDeductionRuleFormRow[] {
  return [...rules].sort((a, b) => {
    const aNum = Number(a.lateArrivalMinutes);
    const bNum = Number(b.lateArrivalMinutes);
    const aOk = Number.isFinite(aNum);
    const bOk = Number.isFinite(bNum);
    if (aOk && bOk) {
      return aNum - bNum;
    }
    if (aOk) {
      return -1;
    }
    if (bOk) {
      return 1;
    }
    return 0;
  });
}

/** Validates only user-editable settings fields. */
export function validateClockInPolicyForm(
  model: ClockInPolicySettingsFormValue,
  lateRulesEditable = LATE_DEDUCTION_RULES_EDITABLE
): FormValidationResult {
  const errors: Record<string, string> = {};

  if (model.workAreaRules.hybrid.locationCheckRequired || model.workAreaRules.remote.locationCheckRequired) {
    const distance = Number(model.allowedDistanceMeters);
    if (
      !model.allowedDistanceMeters.trim() ||
      !Number.isInteger(distance) ||
      distance <= 0
    ) {
      errors['allowedDistanceMeters'] = 'Enter a positive distance in meters.';
    }
  }

  if (lateRulesEditable) {
    const seenMinutes = new Map<number, number>();

    model.lateDeductionRules.forEach((rule, index) => {
      const minutesKey = `lateDeductionRules.${index}.lateArrivalMinutes`;
      const amountKey = `lateDeductionRules.${index}.deductionAmount`;
      const typeKey = `lateDeductionRules.${index}.timeOffTypeId`;

      if (!rule.lateArrivalMinutes.trim()) {
        errors[minutesKey] = 'Enter how many minutes late.';
      } else if (!isIntegerAtLeastOne(rule.lateArrivalMinutes)) {
        errors[minutesKey] = 'Minutes must be a whole number of at least 1.';
      } else {
        const minutes = Number(rule.lateArrivalMinutes);
        const prior = seenMinutes.get(minutes);
        if (prior !== undefined) {
          errors[minutesKey] = 'Each late-by threshold can only be used once.';
          if (!errors[`lateDeductionRules.${prior}.lateArrivalMinutes`]) {
            errors[`lateDeductionRules.${prior}.lateArrivalMinutes`] =
              'Each late-by threshold can only be used once.';
          }
        } else {
          seenMinutes.set(minutes, index);
        }
      }

      if (!rule.deductionAmount.trim()) {
        errors[amountKey] = 'Enter a deduction amount.';
      } else if (!isPositiveNumber(rule.deductionAmount)) {
        errors[amountKey] = 'Deduction amount must be greater than 0.';
      }

      if (!rule.timeOffTypeId.trim()) {
        errors[typeKey] = 'Select a time off type.';
      }
    });
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function mapFormLateRulesToPayload(
  rules: readonly LateDeductionRuleFormRow[]
): UpsertClockInPolicyRequest['lateDeductionRules'] {
  return sortLateDeductionRules(rules).map((r) => ({
    lateArrivalMinute: Number(r.lateArrivalMinutes),
    multiplier: Number(r.deductionAmount),
    timeOffTypeId: r.timeOffTypeId.trim()
  }));
}

function mapExistingLateRulesToPayload(
  existingLateRules: ClockInPolicyResponse['lateDeductionRules']
): UpsertClockInPolicyRequest['lateDeductionRules'] {
  return existingLateRules.map((r) => ({
    lateArrivalMinute: r.lateArrivalMinute,
    multiplier: r.multiplier,
    timeOffTypeId: r.timeOffTypeId
  }));
}

/**
 * Build upsert payload for the company-wide settings screen.
 * Hybrid location check maps to locationVerificationRequired + allowedRadiusMeters.
 * Late deduction rules:
 * - editable → send sorted user-entered rules
 * - not editable + create → []
 * - not editable + update → preserve existing backend rules (Update replaces collection)
 */
export function toUpsertRequest(
  model: ClockInPolicySettingsFormValue,
  existingLateRules: ClockInPolicyResponse['lateDeductionRules'] | null = null,
  now = new Date(),
  lateRulesEditable = LATE_DEDUCTION_RULES_EDITABLE
): UpsertClockInPolicyRequest {
  let lateDeductionRules: UpsertClockInPolicyRequest['lateDeductionRules'];

  if (lateRulesEditable) {
    lateDeductionRules = mapFormLateRulesToPayload(model.lateDeductionRules);
  } else if (existingLateRules && existingLateRules.length > 0) {
    lateDeductionRules = mapExistingLateRulesToPayload(existingLateRules);
  } else {
    lateDeductionRules = [];
  }

  const hybridLocationCheckRequired = model.workAreaRules.hybrid.locationCheckRequired === true;
  const remoteLocationCheckRequired = model.workAreaRules.remote.locationCheckRequired === true;
  const anyLocationCheckRequired = hybridLocationCheckRequired || remoteLocationCheckRequired;

  const cloned = structuredClone(model.workAreaRules);
  const workAreaRules: WorkAreaRules = {
    ...cloned,
    remote: {
      ...cloned.remote,
      locationCheckRequired: remoteLocationCheckRequired
    },
    hybrid: {
      ...cloned.hybrid,
      locationCheckRequired: hybridLocationCheckRequired,
      sourceRule: 'employee_choice'
    },
    field: {
      ...cloned.field,
      photoRequirement: cloned.field.photoRequirement === 'required' ? 'required' : 'off'
    }
  };

  const effectiveTo = safeEffectiveTo(model.effectiveTo);

  return {
    name: safePolicyName(model.name),
    scope: {
      type: 'full_company',
      departmentIds: [],
      positionIds: [],
      employeeIds: []
    },
    effectiveFrom: safeEffectiveFrom(model.effectiveFrom, now),
    effectiveTo: effectiveTo || null,
    locationVerificationRequired: anyLocationCheckRequired,
    allowedRadiusMeters: anyLocationCheckRequired ? Number(model.allowedDistanceMeters) : null,
    workAreaRules,
    correctionRequiresApproval: true,
    notificationRecipientResolver: 'management_coverage_owner',
    lateDeductionRules,
    isActive: true
  };
}
