import { TestBed } from '@angular/core/testing';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { LeavePolicyFormWizardComponent } from './leave-policy-form-wizard.component';

const ANNUAL: LeaveTypeResponse = {
  id: 'lt1',
  name: 'Annual Leave',
  code: 'AL',
  description: null,
  category: 'annual',
  isPaid: true,
  requiresApproval: true,
  requiresDocument: false,
  documentRequiredAfterDays: null,
  acceptedDocumentTypes: [],
  maxConsecutiveDays: null,
  defaultDaysPerYear: 14,
  carryForwardAllowed: true,
  maxCarryForwardDays: 5,
  carryForwardExpiryMonths: 3,
  proRataForNewJoiners: true,
  applicableGender: 'all',
  minimumNoticeDays: 7,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z'
};

describe('LeavePolicyFormWizardComponent', () => {
  it('does not emit save while required business values are blank', () => {
    const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.submit();
    expect(emit).not.toHaveBeenCalled();
    expect(fixture.componentInstance.validationErrors()).toContain('Policy name is required.');
  });

  it('emits a draft after required values are provided', () => {
    const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
    fixture.componentInstance.leaveTypes = [ANNUAL];
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.patchDraftForTest({
      name: 'Annual policy',
      country: 'LK',
      effectiveFrom: '2026-01-01',
      leaveTypes: [{ leaveTypeId: 'lt1', annualEntitlementDays: 14, monthlyAccrualDays: null, carryForwardMaxDays: 5, carryForwardExpiryMonths: 3 }],
      legalEntityIds: ['le1']
    });
    fixture.componentInstance.submit();
    expect(emit).toHaveBeenCalled();
  });

  it('uses three steps instead of repeating a five-screen flow', () => {
    const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.steps).toEqual(['Details', 'Entitlements', 'Rules']);
    expect(fixture.componentInstance.totalSteps).toBe(3);
    expect(fixture.nativeElement.textContent).not.toContain('Five short steps');
    expect(fixture.nativeElement.textContent).not.toContain('Complete this section, then continue.');
    expect(fixture.nativeElement.textContent).not.toContain('Country code');
    expect(fixture.nativeElement.textContent).not.toContain('Job level');
  });

  it('stays on details until name, date, and a legal entity are set', () => {
    const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
    fixture.detectChanges();
    fixture.componentInstance.next();
    expect(fixture.componentInstance.step()).toBe(1);
    expect(fixture.componentInstance.validationErrors()).toContain('Policy name is required.');
  });

  it('copies leave-type defaults when a rule is added', () => {
    const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
    fixture.componentInstance.leaveTypes = [ANNUAL];
    fixture.detectChanges();
    fixture.componentInstance.addRule();
    expect(fixture.componentInstance.draft().leaveTypes).toEqual([
      { leaveTypeId: 'lt1', annualEntitlementDays: 14, monthlyAccrualDays: null, carryForwardMaxDays: 5, carryForwardExpiryMonths: 3 }
    ]);
  });
});
