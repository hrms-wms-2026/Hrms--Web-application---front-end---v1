import { LeavePolicyFormDraft } from '../models/leave-policy.model';
import { createEmptyLeavePolicyFormDraft, toCreateLeavePolicyRequest, validateLeavePolicyFormDraft } from './leave-policy-form.mapper';

function validDraft(): LeavePolicyFormDraft { return { ...createEmptyLeavePolicyFormDraft(), name: 'Engineering annual policy', country: 'LK', accrualMethod: 'monthly', accrualStart: 'after_n_months', accrualAfterNMonths: 3, minimumNoticeDays: 7, effectiveFrom: '2026-01-01', leaveTypes: [{ leaveTypeId: 'lt-1', annualEntitlementDays: 14, monthlyAccrualDays: 1.17, carryForwardMaxDays: 5, carryForwardExpiryMonths: 3 }], legalEntityIds: ['le-1'] }; }
describe('leave policy form mapper', () => {
  it('starts with blank business values', () => { const draft = createEmptyLeavePolicyFormDraft(); expect(draft.country).toBe(''); expect(draft.effectiveFrom).toBe(''); expect(draft.leaveTypes).toEqual([]); expect(draft.legalEntityIds).toEqual([]); });
  it('maps a draft and preserves the explicit replacement confirmation', () => { const request = toCreateLeavePolicyRequest(validDraft(), true); expect(request.country).toBe('LK'); expect(request.accrualAfterNMonths).toBe(3); expect(request.confirmReplaceExistingLegalEntityAssignments).toBe(true); });
  it('requires effective date, a type rule, and a legal entity', () => { const draft = { ...validDraft(), effectiveFrom: '', leaveTypes: [], legalEntityIds: [] }; expect(validateLeavePolicyFormDraft(draft)).toEqual(['Effective date is required.', 'Add at least one leave type rule.', 'Select at least one legal entity.']); });
  it('requires the tenure threshold only for after_n_months accrual', () => { const invalid = { ...validDraft(), accrualAfterNMonths: null }; expect(validateLeavePolicyFormDraft(invalid)).toContain('Enter the number of months before accrual starts.'); expect(validateLeavePolicyFormDraft({ ...invalid, accrualStart: 'immediately' })).not.toContain('Enter the number of months before accrual starts.'); });
});
