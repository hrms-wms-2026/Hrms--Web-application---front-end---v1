import {
  createDefaultClockInPolicyFormModel,
  createEmptyLateDeductionRule,
  formModelFromPolicy,
  LATE_DEDUCTION_RULES_DISABLED_MESSAGE,
  LATE_DEDUCTION_RULES_EDITABLE,
  sortLateDeductionRules,
  toUpsertRequest,
  todayLocalIsoDate,
  validateClockInPolicyForm
} from './clock-in-policy-form.utils';
import { ClockInPolicyResponse } from '../models/clock-in-policy.model';

describe('clock-in-policy-form.utils', () => {
  const detail: ClockInPolicyResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Existing company policy',
    scope: {
      type: 'full_company',
      departmentIds: [],
      positionIds: [],
      employeeIds: []
    },
    effectiveFrom: '2026-08-21',
    effectiveTo: '2026-12-31',
    locationVerificationRequired: true,
    allowedRadiusMeters: 100,
    workAreaRules: {
      onsite: { biometricEnabled: true, webEnabled: false, trayEnabled: false, photoRequired: false },
      remote: { biometricEnabled: false, webEnabled: true, trayEnabled: true, photoRequired: true, locationCheckRequired: false },
      hybrid: {
        biometricEnabled: false,
        webEnabled: true,
        trayEnabled: true,
        photoRequired: true,
        locationCheckRequired: true,
        sourceRule: 'onsite'
      },
      field: { biometricEnabled: false, webEnabled: true, trayEnabled: true, photoRequirement: 'optional' }
    },
    correctionRequiresApproval: false,
    notificationRecipientResolver: 'management_coverage_owner',
    lateDeductionRules: [
      { id: 'r1', lateArrivalMinute: 15, multiplier: 0.5, timeOffTypeId: 'tot-1', isActive: true },
      { id: 'r2', lateArrivalMinute: 30, multiplier: 1, timeOffTypeId: 'tot-2', isActive: true }
    ],
    isActive: false,
    createdById: 'user-1',
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  it('defaults create values including Hybrid employee_choice and today local date', () => {
    const now = new Date(2026, 7, 21);
    const model = createDefaultClockInPolicyFormModel(now);
    expect(model.effectiveFrom).toBe(todayLocalIsoDate(now));
    expect(model.name).toBe('Default clock-in policy');
    expect(model.effectiveTo).toBe('');
    expect(model.workAreaRules.hybrid.sourceRule).toBe('employee_choice');
    expect(model.workAreaRules.hybrid.locationCheckRequired).toBe(false);
    expect(model.allowedDistanceMeters).toBe('');
    expect(model.workAreaRules.field.photoRequirement).toBe('required');
    expect(model.lateDeductionRules).toEqual([]);
  });

  it('maps form model from policy and preserves name/dates while normalizing work areas', () => {
    const model = formModelFromPolicy(detail);
    expect(model.name).toBe('Existing company policy');
    expect(model.effectiveFrom).toBe('2026-08-21');
    expect(model.effectiveTo).toBe('2026-12-31');
    expect(model.allowedDistanceMeters).toBe('100');
    expect(model.workAreaRules.hybrid.locationCheckRequired).toBe(true);
    expect(model.workAreaRules.hybrid.sourceRule).toBe('employee_choice');
    expect(model.workAreaRules.field.photoRequirement).toBe('off');
    // Default LATE_DEDUCTION_RULES_EDITABLE is false — do not load rows into form
    expect(LATE_DEDUCTION_RULES_EDITABLE).toBe(false);
    expect(model.lateDeductionRules).toEqual([]);
  });

  it('loads late deduction rows into form when editing is enabled', () => {
    const model = formModelFromPolicy(detail, undefined, true);
    expect(model.lateDeductionRules).toEqual([
      { lateArrivalMinutes: '15', deductionAmount: '0.5', timeOffTypeId: 'tot-1' },
      { lateArrivalMinutes: '30', deductionAmount: '1', timeOffTypeId: 'tot-2' }
    ]);
  });

  it('falls back to safe defaults when policy name/dates are missing', () => {
    const now = new Date(2026, 7, 21);
    const model = formModelFromPolicy(
      {
        ...detail,
        name: '   ',
        effectiveFrom: '',
        effectiveTo: null
      },
      now
    );
    expect(model.name).toBe('Default clock-in policy');
    expect(model.effectiveFrom).toBe(todayLocalIsoDate(now));
    expect(model.effectiveTo).toBe('');
  });

  it('requires allowed distance only when Hybrid location check is enabled', () => {
    const base = createDefaultClockInPolicyFormModel();
    expect(
      validateClockInPolicyForm({
        ...base,
        workAreaRules: {
          ...base.workAreaRules,
          hybrid: { ...base.workAreaRules.hybrid, locationCheckRequired: false }
        },
        allowedDistanceMeters: ''
      }).valid
    ).toBe(true);
    expect(
      validateClockInPolicyForm({
        ...base,
        workAreaRules: {
          ...base.workAreaRules,
          hybrid: { ...base.workAreaRules.hybrid, locationCheckRequired: true }
        },
        allowedDistanceMeters: ''
      }).errors['allowedDistanceMeters']
    ).toBeTruthy();
  });

  it('skips late-rule validation when editing is disabled', () => {
    const model = createDefaultClockInPolicyFormModel();
    model.lateDeductionRules = [
      { lateArrivalMinutes: '', deductionAmount: '', timeOffTypeId: '' }
    ];
    expect(validateClockInPolicyForm(model, false).valid).toBe(true);
  });

  it('blocks invalid minutes, deduction amount, missing type, and duplicate thresholds', () => {
    const model = createDefaultClockInPolicyFormModel();
    model.lateDeductionRules = [
      { lateArrivalMinutes: '0', deductionAmount: '-1', timeOffTypeId: '' },
      { lateArrivalMinutes: '15', deductionAmount: '1', timeOffTypeId: 'tot-1' },
      { lateArrivalMinutes: '15', deductionAmount: '2', timeOffTypeId: 'tot-2' }
    ];
    const result = validateClockInPolicyForm(model, true);
    expect(result.valid).toBe(false);
    expect(result.errors['lateDeductionRules.0.lateArrivalMinutes']).toContain('at least 1');
    expect(result.errors['lateDeductionRules.0.deductionAmount']).toContain('greater than 0');
    expect(result.errors['lateDeductionRules.0.timeOffTypeId']).toContain('time off type');
    expect(result.errors['lateDeductionRules.1.lateArrivalMinutes']).toContain('once');
    expect(result.errors['lateDeductionRules.2.lateArrivalMinutes']).toContain('once');
  });

  it('requires minutes and deduction amount when blank', () => {
    const model = createDefaultClockInPolicyFormModel();
    model.lateDeductionRules = [createEmptyLateDeductionRule()];
    const result = validateClockInPolicyForm(model, true);
    expect(result.errors['lateDeductionRules.0.lateArrivalMinutes']).toBeTruthy();
    expect(result.errors['lateDeductionRules.0.deductionAmount']).toBeTruthy();
    expect(result.errors['lateDeductionRules.0.timeOffTypeId']).toBeTruthy();
  });

  it('sorts late deduction rules by late arrival minutes before payload submit', () => {
    const sorted = sortLateDeductionRules([
      { lateArrivalMinutes: '30', deductionAmount: '1', timeOffTypeId: 'tot-b' },
      { lateArrivalMinutes: '5', deductionAmount: '0.5', timeOffTypeId: 'tot-a' },
      { lateArrivalMinutes: '15', deductionAmount: '0.75', timeOffTypeId: 'tot-c' }
    ]);
    expect(sorted.map((r) => r.lateArrivalMinutes)).toEqual(['5', '15', '30']);

    const model = createDefaultClockInPolicyFormModel();
    model.lateDeductionRules = [
      { lateArrivalMinutes: '30', deductionAmount: '1', timeOffTypeId: 'tot-b' },
      { lateArrivalMinutes: '5', deductionAmount: '0.5', timeOffTypeId: 'tot-a' }
    ];
    const payload = toUpsertRequest(model, null, undefined, true);
    expect(payload.lateDeductionRules).toEqual([
      { lateArrivalMinute: 5, multiplier: 0.5, timeOffTypeId: 'tot-a' },
      { lateArrivalMinute: 30, multiplier: 1, timeOffTypeId: 'tot-b' }
    ]);
  });

  it('create payload maps Hybrid location check off to locationVerificationRequired false', () => {
    const now = new Date(2026, 7, 21);
    const model = createDefaultClockInPolicyFormModel(now);
    model.workAreaRules = {
      ...model.workAreaRules,
      field: {
        ...model.workAreaRules.field,
        photoRequirement: 'off'
      }
    };
    const payload = toUpsertRequest(model, null, now, false);
    expect(payload.name).toBe('Default clock-in policy');
    expect(payload.effectiveFrom).toBe(todayLocalIsoDate(now));
    expect(payload.effectiveTo).toBeNull();
    expect(payload.workAreaRules.hybrid.locationCheckRequired).toBe(false);
    expect(payload.locationVerificationRequired).toBe(false);
    expect(payload.allowedRadiusMeters).toBeNull();
    expect(payload.lateDeductionRules).toEqual([]);
    expect(payload.scope).toEqual({
      type: 'full_company',
      departmentIds: [],
      positionIds: [],
      employeeIds: []
    });
    expect(payload.isActive).toBe(true);
    expect(payload.correctionRequiresApproval).toBe(true);
    expect(payload.notificationRecipientResolver).toBe('management_coverage_owner');
    expect(payload.workAreaRules.hybrid.sourceRule).toBe('employee_choice');
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('either');
  });

  it('when late rules disabled, update preserves existing backend rules', () => {
    const model = formModelFromPolicy(detail, undefined, false);
    model.allowedDistanceMeters = '75';
    const payload = toUpsertRequest(model, detail.lateDeductionRules, undefined, false);
    expect(payload.workAreaRules.hybrid.locationCheckRequired).toBe(true);
    expect(payload.locationVerificationRequired).toBe(true);
    expect(payload.allowedRadiusMeters).toBe(75);
    expect(payload.name).toBe('Existing company policy');
    expect(payload.lateDeductionRules).toEqual([
      { lateArrivalMinute: 15, multiplier: 0.5, timeOffTypeId: 'tot-1' },
      { lateArrivalMinute: 30, multiplier: 1, timeOffTypeId: 'tot-2' }
    ]);
    expect(payload.isActive).toBe(true);
  });

  it('when late rules editable, update sends form rules not preserved backend copy', () => {
    const model = formModelFromPolicy(detail, undefined, true);
    model.lateDeductionRules = [
      { lateArrivalMinutes: '10', deductionAmount: '0.25', timeOffTypeId: 'tot-new' }
    ];
    const payload = toUpsertRequest(model, detail.lateDeductionRules, undefined, true);
    expect(payload.lateDeductionRules).toEqual([
      { lateArrivalMinute: 10, multiplier: 0.25, timeOffTypeId: 'tot-new' }
    ]);
  });

  it('maps Field photo checkbox checked→required and unchecked→off', () => {
    const model = createDefaultClockInPolicyFormModel();
    model.workAreaRules = {
      ...model.workAreaRules,
      field: { ...model.workAreaRules.field, photoRequirement: 'required' }
    };
    expect(toUpsertRequest(model).workAreaRules.field.photoRequirement).toBe('required');

    model.workAreaRules = {
      ...model.workAreaRules,
      field: { ...model.workAreaRules.field, photoRequirement: 'off' }
    };
    expect(toUpsertRequest(model).workAreaRules.field.photoRequirement).toBe('off');
  });

  it('exposes disabled message constant without forbidden placeholder wording', () => {
    expect(LATE_DEDUCTION_RULES_DISABLED_MESSAGE).toBe(
      'Time off types must be configured before late deduction rules can be added.'
    );
    expect(LATE_DEDUCTION_RULES_DISABLED_MESSAGE).not.toContain(
      'Late deduction setup will be added after Time Off types are available.'
    );
  });
});
