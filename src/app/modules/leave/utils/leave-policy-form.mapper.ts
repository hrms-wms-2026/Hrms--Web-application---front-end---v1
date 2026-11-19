import { CreateLeavePolicyRequest, LeavePolicyFormDraft } from '../models/leave-policy.model';

export function createEmptyLeavePolicyFormDraft(): LeavePolicyFormDraft {
  return { name: '', description: null, country: '', jobLevel: null, accrualMethod: 'annual', accrualStart: 'immediately', accrualAfterNMonths: null, prorationMethod: 'calendar_days', probationRestriction: false, minimumTenureMonths: 0, firstYearReducedPercent: null, minimumNoticeDays: 0, maxConsecutiveDays: null, minDaysPerRequest: 0.5, maxTeamAbsencePercent: null, approvalMode: 'any_one', effectiveFrom: '', leaveTypes: [], blackoutPeriods: [], legalEntityIds: [] };
}

export function validateLeavePolicyFormDraft(draft: LeavePolicyFormDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('Policy name is required.');
  if (!draft.effectiveFrom.trim()) errors.push('Effective date is required.');
  if (draft.leaveTypes.length === 0) errors.push('Add at least one leave type rule.');
  if (draft.legalEntityIds.length === 0) errors.push('Select at least one legal entity.');
  if (draft.accrualStart === 'after_n_months' && (!draft.accrualAfterNMonths || draft.accrualAfterNMonths < 1)) errors.push('Enter the number of months before accrual starts.');
  for (const rule of draft.leaveTypes) {
    if (!rule.leaveTypeId) errors.push('Each leave type rule needs a leave type.');
    if (draft.accrualMethod === 'monthly') {
      if (rule.monthlyAccrualDays === null || rule.monthlyAccrualDays <= 0) errors.push('Monthly accrual days are required when accrual is monthly.');
    } else if (rule.annualEntitlementDays <= 0) {
      errors.push('Annual entitlement days must be greater than 0.');
    }
    if (rule.monthlyAccrualDays !== null && rule.monthlyAccrualDays < 0) errors.push('Monthly accrual days cannot be negative.');
  }
  for (const blackout of draft.blackoutPeriods) { if (!blackout.startDate || !blackout.endDate) errors.push('Each blackout period needs a start and end date.'); if (blackout.startDate && blackout.endDate && blackout.endDate < blackout.startDate) errors.push('Blackout period end date must be on or after start date.'); }
  return [...new Set(errors)];
}

export function toCreateLeavePolicyRequest(draft: LeavePolicyFormDraft, confirmReplaceExistingLegalEntityAssignments: boolean): CreateLeavePolicyRequest {
  return { ...draft, name: draft.name.trim(), description: emptyToNull(draft.description), country: draft.country.trim().toUpperCase(), jobLevel: null, blackoutPeriods: draft.blackoutPeriods.map((period) => ({ startDate: period.startDate, endDate: period.endDate, reason: emptyToNull(period.reason) })), confirmReplaceExistingLegalEntityAssignments };
}
function emptyToNull(value: string | null): string | null { const trimmed = value?.trim(); return trimmed ? trimmed : null; }
