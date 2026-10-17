import { openSelect } from '../../../../shared/ui/select/select.testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { NewLeaveRequestWizardComponent } from './new-leave-request-wizard.component';

describe('NewLeaveRequestWizardComponent', () => {
  let fixture: ComponentFixture<NewLeaveRequestWizardComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0, isActive: true, createdAt: '2026-08-21T00:00:00Z' }
  ];
  const balances: LeaveBalanceResponse[] = [
    { employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, entitledHours: 160, annualHours: 160, carriedForwardHours: 0, usedHours: 40, pendingHours: 0, remainingHours: 120, isNegative: false, carryForwardExpiresOn: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewLeaveRequestWizardComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(NewLeaveRequestWizardComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('leaveTypes', leaveTypes);
    fixture.componentRef.setInput('balances', balances);
    fixture.componentRef.setInput('workStartTime', '09:00');
    fixture.componentRef.setInput('workEndTime', '18:00');
    fixture.componentRef.setInput('timezone', 'UTC');
  });

  it('shows remaining hours next to each leave type option', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('[data-testid="leave-type-select"]') as HTMLElement;
    const options = openSelect(host, () => fixture.detectChanges());
    expect(options.some((o) => o.textContent?.includes('Annual Leave') && o.textContent?.includes('120 hours remaining'))).toBe(true);
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

  it('emits preview with startAt/endAt and no halfDayPeriod when leaving step 2', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({
      ...d, leaveTypeId: 'type-1', startDate: '2026-09-09', startTime: '14:00', endDate: '2026-09-09', endTime: '18:00'
    }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T14:00:00.000Z',
      endAt: '2026-09-09T18:00:00.000Z',
      reason: null,
      fileRecordIds: []
    }]);
    expect(JSON.stringify(emitted[0])).not.toContain('halfDayPeriod');
  });

  it('disables Continue on step 2 when the work window is unset', () => {
    fixture.componentRef.setInput('workStartTime', null);
    fixture.componentRef.setInput('workEndTime', null);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-09', endDate: '2026-09-09' }));
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    expect(fixture.componentInstance.canLeaveStep(2)).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="work-window-required"]')?.textContent).toContain('Set work start and end in General Settings first.');
  });

  it('disables Continue on step 3 when the preview returned an error', () => {
    fixture.componentRef.setInput('previewError', 'No approver found in your reporting line. Please contact HR');
    fixture.componentInstance.step.set(3);
    fixture.detectChanges();
    expect(fixture.componentInstance.canLeaveStep(3)).toBe(false);
    const continueButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.trim() === 'Continue');
    expect(continueButton?.disabled).toBe(true);
  });

  it('disables Continue on step 3 while the preview is still calculating', () => {
    fixture.componentRef.setInput('previewing', true);
    fixture.componentInstance.step.set(3);
    fixture.detectChanges();
    expect(fixture.componentInstance.canLeaveStep(3)).toBe(false);
  });

  it('allows Continue on step 3 once a preview result is available', () => {
    fixture.componentRef.setInput('previewResult', { totalHours: 8 } as LeaveRequestResponse);
    fixture.componentInstance.step.set(3);
    expect(fixture.componentInstance.canLeaveStep(3)).toBe(true);
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
    fixture.componentInstance.draft.update((d) => ({
      ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Trip'
    }));
    fixture.componentInstance.step.set(5);
    const emitted: unknown[] = [];
    fixture.componentInstance.submitRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted).toEqual([{
      employeeId: 'emp-2',
      leaveTypeId: 'type-1',
      startAt: '2026-09-10T09:00:00.000Z',
      endAt: '2026-09-12T18:00:00.000Z',
      reason: 'Trip',
      fileRecordIds: []
    }]);
  });

  it('shows the leave type name, not the id, on the review step', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.step.set(5);
    fixture.detectChanges();
    const review = fixture.nativeElement.querySelector('[data-testid="request-review"]') as HTMLElement;
    expect(review.textContent).toContain('Annual Leave');
    expect(review.textContent).not.toContain('type-1');
    expect(review.textContent).toContain('2026-09-10');
  });

  it('hides the document note when the selected type does not require a document', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.step.set(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Document upload is not available yet');
    expect(fixture.nativeElement.querySelector('[data-testid="document-note"]')).toBeNull();
  });

  it('prefills start and end dates from initialStartDate and initialEndDate', () => {
    fixture.componentRef.setInput('initialStartDate', '2026-09-10');
    fixture.componentRef.setInput('initialEndDate', '2026-09-10');
    fixture.detectChanges();
    fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.draft().startDate).toBe('2026-09-10');
    expect(fixture.componentInstance.draft().endDate).toBe('2026-09-10');
  });

  it('explains the document rule when the selected type requires a document', () => {
    fixture.componentRef.setInput('leaveTypes', [{ ...leaveTypes[0], requiresDocument: true, documentRequiredAfterDays: 3 }]);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.step.set(4);
    fixture.detectChanges();
    const note = fixture.nativeElement.querySelector('[data-testid="document-note"]') as HTMLElement;
    expect(note.textContent).toContain('3');
    expect(fixture.nativeElement.querySelector('[data-testid="document-input"]')).toBeTruthy();
  });

  it('moves the To date along with the From date and explains why Continue is disabled', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.step.set(2);
    expect(fixture.componentInstance.dateRangeHint()).toBe('Choose the date your leave starts.');
    fixture.componentInstance.onStartDateChange('2026-10-07');
    expect(fixture.componentInstance.draft().endDate).toBe('2026-10-07');
    expect(fixture.componentInstance.canLeaveStep(2)).toBe(true);
    fixture.componentInstance.draft.update((d) => ({ ...d, endDate: '2026-10-05' }));
    expect(fixture.componentInstance.dateRangeHint()).toBe('The end date must be on or after the start date.');
    expect(fixture.componentInstance.canLeaveStep(2)).toBe(false);
  });

  it('shows the reason and the approver on the review step', () => {
    fixture.componentRef.setInput('previewResult', {
      totalHours: 16, paidHours: 16, unpaidHours: 0, noticePeriodMissed: false,
      balanceImpact: { currentRemainingHours: 40, pendingAfterSubmitHours: 16, remainingAfterSubmitHours: 24 },
      approvers: [{ approverEmployeeId: 'emp-9', approverName: 'Mathusanth Kumaran', sequenceOrder: 1, status: 'pending', delegatedFromApproverId: null }],
      conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null }
    } as unknown as LeaveRequestResponse);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-10-07', endDate: '2026-10-08', reason: 'Family function' }));
    fixture.componentInstance.step.set(5);
    fixture.detectChanges();
    const review = fixture.nativeElement.querySelector('[data-testid="request-review"]') as HTMLElement;
    expect(review.textContent).toContain('Family function');
    expect(review.textContent).toContain('2026-10-07 (Wed)');
    expect((fixture.nativeElement.querySelector('[data-testid="review-approver"]') as HTMLElement).textContent).toContain('Mathusanth Kumaran');
  });
});
