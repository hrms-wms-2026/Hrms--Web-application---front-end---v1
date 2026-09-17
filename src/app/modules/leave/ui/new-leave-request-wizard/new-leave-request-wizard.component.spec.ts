import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { NewLeaveRequestWizardComponent } from './new-leave-request-wizard.component';

describe('NewLeaveRequestWizardComponent', () => {
  let fixture: ComponentFixture<NewLeaveRequestWizardComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0, isActive: true, createdAt: '2026-08-21T00:00:00Z' }
  ];
  const balances: LeaveBalanceResponse[] = [
    { employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, entitledDays: 20, annualDays: 20, carriedForwardDays: 0, usedDays: 5, pendingDays: 0, remainingDays: 15, isNegative: false, carryForwardExpiresOn: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewLeaveRequestWizardComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(NewLeaveRequestWizardComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('leaveTypes', leaveTypes);
    fixture.componentRef.setInput('balances', balances);
  });

  it('shows remaining days next to each leave type option', () => {
    fixture.detectChanges();
    const options: HTMLOptionElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="leave-type-select"] option'));
    expect(options.some((o) => o.textContent?.includes('Annual Leave') && o.textContent?.includes('15 days remaining'))).toBe(true);
  });

  it('does not advance past step 1 until a leave type is picked', () => {
    fixture.detectChanges();
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(1);
  });

  it('advances through steps once required fields are filled', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(2);
    fixture.componentInstance.draft.update((d) => ({ ...d, startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(3);
  });

  it('emits preview with the current draft when leaving step 2', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{ leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, reason: null, fileRecordIds: [] }]);
  });

  it('requires an employee to be picked in on-behalf mode before advancing', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(1);
    fixture.componentInstance.onEmployeePicked('emp-2');
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(2);
  });

  it('emits submit with the on-behalf shape in on-behalf mode', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.onEmployeePicked('emp-2');
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Trip' }));
    fixture.componentInstance.step.set(5);
    const emitted: unknown[] = [];
    fixture.componentInstance.submitRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted).toEqual([{ employeeId: 'emp-2', leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, reason: 'Trip', fileRecordIds: [] }]);
  });
});
