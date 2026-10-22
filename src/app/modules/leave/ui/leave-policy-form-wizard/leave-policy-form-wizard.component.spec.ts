import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { LeavePolicyDetail, LeavePolicyVersion } from '../../models/leave-policy.model';
import { LeavePolicyFormWizardComponent } from './leave-policy-form-wizard.component';

const annual: LeaveTypeResponse = {
  id: 't-annual', name: 'Annual Leave', code: 'AL', description: null, color: '#2563EB', isPaid: true,
  applicableGender: 'all', requiresDocument: false, documentRequiredAfterHours: null, acceptedDocumentTypes: [],
  isActive: true, createdAt: '2026-01-01T00:00:00Z', policyCount: 0
};

function create(entities = [{ id: 'le1', name: 'Dapi Technologies' }]): ComponentFixture<LeavePolicyFormWizardComponent> {
  const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
  fixture.componentRef.setInput('leaveTypes', [annual]);
  fixture.componentRef.setInput('legalEntities', entities);
  fixture.componentRef.setInput('departmentOptions', [{ value: 'd-sales', label: 'Sales' }, { value: 'd-eng', label: 'Engineering' }]);
  fixture.componentRef.setInput('positionOptions', [{ value: 'p-dev', label: 'Developer' }]);
  fixture.detectChanges();
  return fixture;
}

function fillValidCreate(w: LeavePolicyFormWizardComponent): void {
  w.leaveTypeId.set('t-annual');
  w.name.set('Annual - standard');
  w.amountHours.set(8);
  w.amountPeriod.set('month');
  w.eligibleFrom.set('after_probation');
  w.minimumNoticeDays.set(7);
  w.minRequestHours.set(1);
  w.maxRequestHours.set(40);
}

function version(overrides: Partial<LeavePolicyVersion> = {}): LeavePolicyVersion {
  return {
    id: 'v1', versionNumber: 1, effectiveFrom: '2026-01-01', isCurrent: true, isFuture: false,
    createdAt: '2026-01-01T00:00:00Z', createdByName: 'Asha', amountHours: 8, amountPeriod: 'month',
    carryForwardCapHours: null, carryForwardExpiryMonths: null, eligibleFrom: 'immediately', eligibleAfterMonths: null,
    minimumNoticeDays: 0, minRequestHours: 1, maxRequestHours: null, maxTeamAbsencePercent: null,
    approvalMode: 'any_one', blackouts: [], ...overrides
  };
}

function detail(versions: LeavePolicyVersion[]): LeavePolicyDetail {
  return {
    id: 'p1', name: 'Annual - standard', description: null, leaveTypeId: 't-annual', leaveTypeName: 'Annual Leave',
    leaveTypeColor: '#2563EB', isActive: true, current: versions.find((v) => v.isCurrent) ?? versions[0], versions,
    assignments: [{ id: 'a1', targetKind: 'legal_entity', targetId: 'le1', targetName: 'Dapi Technologies', effectiveFrom: '2026-01-01' }]
  };
}

describe('LeavePolicyFormWizardComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('does not leave the amount step while hours are zero', () => {
    const w = create().componentInstance;
    fillValidCreate(w);
    w.next();
    w.amountHours.set(0);
    w.next();
    expect(w.step()).toBe(2);
    expect(w.validationErrors().length).toBeGreaterThan(0);
  });

  it('needs a cap when carrying over only part of the hours', () => {
    const w = create().componentInstance;
    fillValidCreate(w);
    w.next();
    w.carryMode.set('cap');
    w.carryCapHours.set(null);
    w.next();
    expect(w.step()).toBe(2);
    w.carryCapHours.set(40);
    w.next();
    expect(w.step()).toBe(3);
  });

  it('needs a month count for "after a number of months"', () => {
    const w = create().componentInstance;
    fillValidCreate(w);
    w.next();
    w.eligibleFrom.set('after_months');
    w.eligibleAfterMonths.set(null);
    w.next();
    expect(w.step()).toBe(2);
  });

  it('pre-ticks and hides the only company', () => {
    const fixture = create();
    const w = fixture.componentInstance;
    expect(w.companyIds()).toEqual(['le1']);
    fillValidCreate(w);
    w.next(); w.next();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="company-choices"]')).toBeNull();
  });

  it('shows every company unticked when there are several', () => {
    const fixture = create([{ id: 'le1', name: 'Dapi LK' }, { id: 'le2', name: 'Dapi UK' }]);
    const w = fixture.componentInstance;
    expect(w.companyIds()).toEqual([]);
    fillValidCreate(w);
    w.next(); w.next();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="company-choices"]')).not.toBeNull();
  });

  it('emits the whole create payload', () => {
    const w = create().componentInstance;
    const emit = vi.spyOn(w.create, 'emit');
    fillValidCreate(w);
    w.submit();
    expect(emit).toHaveBeenCalledWith({
      leaveTypeId: 't-annual', name: 'Annual - standard', description: null,
      rules: {
        amountHours: 8, amountPeriod: 'month', carryForwardCapHours: null, carryForwardExpiryMonths: null,
        eligibleFrom: 'after_probation', eligibleAfterMonths: null, minimumNoticeDays: 7, minRequestHours: 1,
        maxRequestHours: 40, maxTeamAbsencePercent: null, approvalMode: 'any_one', blackouts: []
      },
      assignments: [{ targetKind: 'legal_entity', targetId: 'le1' }],
      replaceConflicts: false
    });
  });

  it('shows conflicts and resends with replaceConflicts after confirming', () => {
    const fixture = create();
    const w = fixture.componentInstance;
    const emit = vi.spyOn(w.create, 'emit');
    fillValidCreate(w);
    w.addDepartment('d-sales');
    w.submit();
    fixture.componentRef.setInput('conflicts', [{
      targetKind: 'department', targetId: 'd-sales', targetName: 'Sales', existingPolicyId: 'p9', existingPolicyName: 'Annual - sales'
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Sales department already uses 'Annual - sales' for Annual Leave.");
    w.confirmReplace();
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ replaceConflicts: true }));
  });

  it('edit: blocks an apply-from date in the past', () => {
    const fixture = create();
    fixture.componentRef.setInput('policy', detail([version()]));
    fixture.detectChanges();
    const w = fixture.componentInstance;
    w.amountHours.set(10);
    w.applyFrom.set('2026-10-19');
    expect(w.canSubmit()).toBe(false);
    w.applyFrom.set('2026-10-20');
    expect(w.canSubmit()).toBe(true);
  });

  it('edit: changed hours are saved as a new version, not a new policy', () => {
    const fixture = create();
    fixture.componentRef.setInput('policy', detail([version()]));
    fixture.detectChanges();
    const w = fixture.componentInstance;
    const createEmit = vi.spyOn(w.create, 'emit');
    const editEmit = vi.spyOn(w.saveEdit, 'emit');
    w.amountHours.set(10);
    w.applyFrom.set('2026-11-01');
    w.submit();
    expect(createEmit).not.toHaveBeenCalled();
    expect(editEmit).toHaveBeenCalledWith({
      policyId: 'p1',
      edit: {
        details: null,
        version: { applyFrom: '2026-11-01', rules: expect.objectContaining({ amountHours: 10, amountPeriod: 'month' }) },
        assignments: null,
        replaceConflicts: false
      }
    });
  });

  it('edit: prefills from a scheduled change and applies from its date', () => {
    const fixture = create();
    fixture.componentRef.setInput('policy', detail([
      version({ id: 'v2', versionNumber: 2, effectiveFrom: '2026-11-01', isCurrent: false, isFuture: true, amountHours: 12 }),
      version()
    ]));
    fixture.detectChanges();
    const w = fixture.componentInstance;
    expect(w.amountHours()).toBe(12);
    expect(w.applyFrom()).toBe('2026-11-01');
    expect(w.scheduledNote()).toContain('1 Nov 2026');
  });

  it('edit: a version already starting today moves Apply from to tomorrow and blocks today', () => {
    const fixture = create();
    fixture.componentRef.setInput('policy', detail([version({ effectiveFrom: '2026-10-20' })]));
    fixture.detectChanges();
    const w = fixture.componentInstance;
    expect(w.applyFrom()).toBe('2026-10-21');
    w.applyFrom.set('2026-10-20');
    expect(w.canSubmit()).toBe(false);
  });

  it('Replace is ignored once the targets changed after the conflicts were shown', () => {
    const fixture = create();
    const w = fixture.componentInstance;
    const emit = vi.spyOn(w.create, 'emit');
    fillValidCreate(w);
    w.addDepartment('d-sales');
    w.submit();
    fixture.componentRef.setInput('conflicts', [{
      targetKind: 'department', targetId: 'd-sales', targetName: 'Sales', existingPolicyId: 'p9', existingPolicyName: 'Annual - sales'
    }]);
    fixture.detectChanges();
    w.addDepartment('d-eng');
    fixture.detectChanges();
    expect(w.conflictLines()).toEqual([]);
    w.confirmReplace();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('Replace still validates the form', () => {
    const fixture = create();
    const w = fixture.componentInstance;
    const emit = vi.spyOn(w.create, 'emit');
    fillValidCreate(w);
    w.submit();
    fixture.componentRef.setInput('conflicts', [{
      targetKind: 'legal_entity', targetId: 'le1', targetName: 'Dapi Technologies', existingPolicyId: 'p9', existingPolicyName: 'Annual - company'
    }]);
    w.amountHours.set(0);
    w.confirmReplace();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('edit: prefills once, so a later policy input does not overwrite what was typed', () => {
    const fixture = create();
    fixture.componentRef.setInput('policy', detail([version()]));
    fixture.detectChanges();
    const w = fixture.componentInstance;
    w.amountHours.set(15);
    fixture.componentRef.setInput('policy', { ...detail([version({ amountHours: 99 })]), id: 'p2' });
    fixture.detectChanges();
    expect(w.amountHours()).toBe(15);
  });

  it('a blackout with only one date is an error, not silently dropped', () => {
    const w = create().componentInstance;
    const emit = vi.spyOn(w.create, 'emit');
    fillValidCreate(w);
    w.addBlackout();
    w.updateBlackout(0, 'startDate', '2026-12-20');
    w.submit();
    expect(emit).not.toHaveBeenCalled();
    expect(w.validationErrors()).toContain('Each blackout needs a start and an end date.');
  });
});
