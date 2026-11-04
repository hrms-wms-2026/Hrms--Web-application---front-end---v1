import { openSelect } from '../../../../shared/ui/select/select.testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { NewLeaveRequestWizardComponent, halfDayWindows } from './new-leave-request-wizard.component';

describe('NewLeaveRequestWizardComponent', () => {
  let fixture: ComponentFixture<NewLeaveRequestWizardComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, color: '#2563EB', isPaid: true, applicableGender: 'all', requiresDocument: false, documentRequiredAfterHours: null, acceptedDocumentTypes: [], isActive: true, createdAt: '2026-08-21T00:00:00Z', policyCount: 1 }
  ];
  const balances: LeaveBalanceResponse[] = [
    { employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, entitledHours: 160, annualHours: 160, carriedForwardHours: 0, usedHours: 40, pendingHours: 0, remainingHours: 120, isNegative: false, carryForwardExpiresOn: null }
  ];

  function preview(overrides: Partial<LeaveRequestResponse> = {}): LeaveRequestResponse {
    return {
      totalHours: 8, paidHours: 8, unpaidHours: 0, noticePeriodMissed: false, exceedsBalanceByHours: 0,
      balanceImpact: { currentRemainingHours: 120, pendingAfterSubmitHours: 8, remainingAfterSubmitHours: 112 },
      approvers: [], conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
      ...overrides
    } as unknown as LeaveRequestResponse;
  }

  function submitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="submit-request"] button') as HTMLButtonElement;
  }

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

  it('shows every field on one screen, with no steps', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Leave type');
    expect(text).toContain('Date range');
    expect(text).toContain('Full Day');
    expect(text).toContain('Half Day');
    expect(text).toContain('Custom Hours');
    expect(text).toContain('Reason');
    // Times are only asked for with Custom Hours.
    expect(text).not.toContain('To time');
    expect(text).not.toContain('Step 1 of 5');
    expect(submitButton().textContent).toContain('Submit Request');
  });

  it('shows only the leading calendar icon on the date fields, no calendar button', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-date-picker').length).toBe(2);
    expect(fixture.nativeElement.querySelector('app-date-picker .ui-field__trailing')).toBeNull();
  });

  it('shows the first three leave types as chips and picks one on click', () => {
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('[data-testid="leave-type-chip"]') as NodeListOf<HTMLButtonElement>;
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Annual Leave');
    expect(chips[0].title).toContain('120 hours remaining');
    expect(fixture.nativeElement.querySelector('[data-testid="leave-type-select"]')).toBeNull();
    chips[0].click();
    expect(fixture.componentInstance.draft().leaveTypeId).toBe('type-1');
  });

  it('puts leave types beyond the first three in the dropdown, with remaining hours', () => {
    const more = ['type-2', 'type-3', 'type-4'].map((id, i) => ({ ...leaveTypes[0], id, name: `Type ${i + 2}`, code: `T${i + 2}` }));
    fixture.componentRef.setInput('leaveTypes', [...more, leaveTypes[0]]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="leave-type-chip"]').length).toBe(3);
    const host = fixture.nativeElement.querySelector('[data-testid="leave-type-select"]') as HTMLElement;
    const options = openSelect(host, () => fixture.detectChanges());
    expect(options.some((o) => o.textContent?.includes('Annual Leave') && o.textContent?.includes('120 hours remaining'))).toBe(true);
  });

  it('keeps Submit disabled until a leave type and dates are filled', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.onStartDateChange('2026-09-10');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('previews as soon as the type and dates are valid, without halfDayPeriod, and not again for a reason edit', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.detectChanges();
    fixture.componentInstance.onDurationChange('custom');
    fixture.componentInstance.draft.update((d) => ({
      ...d, leaveTypeId: 'type-1', startDate: '2026-09-09', startTime: '14:00', endDate: '2026-09-09', endTime: '18:00'
    }));
    fixture.detectChanges();
    expect(emitted).toEqual([{
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T14:00:00.000Z',
      endAt: '2026-09-09T18:00:00.000Z',
      reason: null,
      fileRecordIds: []
    }]);
    expect(JSON.stringify(emitted[0])).not.toContain('halfDayPeriod');

    fixture.componentInstance.draft.update((d) => ({ ...d, reason: 'Trip' }));
    fixture.detectChanges();
    expect(emitted.length).toBe(1);
  });

  it('blocks Submit and explains when the work window is unset', () => {
    fixture.componentRef.setInput('workStartTime', null);
    fixture.componentRef.setInput('workEndTime', null);
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-09', endDate: '2026-09-09' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="work-window-required"]')?.textContent).toContain('Set work start and end in General Settings first');
  });

  it('drops the work-window error once the work hours arrive after opening', () => {
    fixture.componentRef.setInput('workStartTime', null);
    fixture.componentRef.setInput('workEndTime', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="work-window-required"]')).not.toBeNull();
    fixture.componentRef.setInput('workStartTime', '09:00');
    fixture.componentRef.setInput('workEndTime', '18:00');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="work-window-required"]')).toBeNull();
  });

  it('disables Submit and shows the error when the preview failed', () => {
    fixture.componentRef.setInput('previewError', 'No approver found in your reporting line. Please contact HR');
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    expect(submitButton().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="preview-error"]')?.textContent).toContain('No approver found');
  });

  it('disables Submit while the preview is still calculating', () => {
    fixture.componentRef.setInput('previewing', true);
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.canSubmit()).toBe(false);
  });

  it('requires an employee to be picked in on-behalf mode', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10' }));
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.onEmployeePicked('emp-2');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('emits submit with the on-behalf shape in on-behalf mode', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.onEmployeePicked('emp-2');
    fixture.componentInstance.draft.update((d) => ({
      ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Trip'
    }));
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

  it('hides the document note when the selected type does not require a document', () => {
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="document-note"]')).toBeNull();
  });

  it('explains the document rule when the selected type requires a document', () => {
    fixture.componentRef.setInput('leaveTypes', [{ ...leaveTypes[0], requiresDocument: true, documentRequiredAfterHours: 24 }]);
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.detectChanges();
    const note = fixture.nativeElement.querySelector('[data-testid="document-note"]') as HTMLElement;
    expect(note.textContent).toContain('longer than 24 hours');
    expect(fixture.nativeElement.querySelector('[data-testid="document-input"]')).toBeTruthy();
  });

  it('prefills start and end dates from initialStartDate and initialEndDate', () => {
    fixture.componentRef.setInput('initialStartDate', '2026-09-10');
    fixture.componentRef.setInput('initialEndDate', '2026-09-10');
    fixture.detectChanges();
    expect(fixture.componentInstance.draft().startDate).toBe('2026-09-10');
    expect(fixture.componentInstance.draft().endDate).toBe('2026-09-10');
  });

  it('moves the To date along with the From date and explains why Submit is disabled', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    expect(fixture.componentInstance.dateRangeHint()).toBe('Choose the date your leave starts.');
    fixture.componentInstance.onStartDateChange('2026-10-07');
    expect(fixture.componentInstance.draft().endDate).toBe('2026-10-07');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
    fixture.componentInstance.draft.update((d) => ({ ...d, endDate: '2026-10-05' }));
    expect(fixture.componentInstance.dateRangeHint()).toBe('The end date must be on or after the start date.');
    expect(fixture.componentInstance.canSubmit()).toBe(false);
  });

  it('shows each policy warning once, in the warning banner', () => {
    fixture.componentRef.setInput('previewResult', preview({
      noticePeriodMissed: true,
      conflictSnapshot: { warnings: [{ code: 'notice_period_missed', message: 'This request does not meet the minimum notice period of 1 days. Your manager will be informed.' }], calendarConflicts: [], teamAbsencePercent: null }
    } as Partial<LeaveRequestResponse>));
    fixture.detectChanges();
    const warnings = fixture.nativeElement.querySelectorAll('[data-testid="policy-warning"]') as NodeListOf<HTMLElement>;
    expect(warnings.length).toBe(1);
    expect(warnings[0].textContent).toContain('minimum notice period of 1 days');
  });

  it('warns, but still allows submitting, when the request is more than the balance', () => {
    fixture.componentRef.setInput('previewResult', preview({ exceedsBalanceByHours: 24 }));
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10' }));
    fixture.detectChanges();
    const warning = fixture.nativeElement.querySelector('[data-testid="over-balance"]') as HTMLElement;
    expect(warning.textContent).toContain('This is 24 h more than your balance. If approved, your balance goes negative.');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('shows no over-balance warning when the request fits', () => {
    fixture.componentRef.setInput('previewResult', preview());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="over-balance"]')).toBeNull();
  });

  it('Full Day asks for the whole work window on each date', () => {
    const emitted: { startAt: string; endAt: string }[] = [];
    fixture.componentInstance.previewRequested.subscribe((e) => emitted.push(e));
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-11' }));
    fixture.detectChanges();
    expect(emitted.at(-1)).toMatchObject({ startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-11T18:00:00.000Z' });
  });

  it('Half Day leaves the break between the halves, so each half is half a work day', () => {
    fixture.componentRef.setInput('breakMinutes', 60);
    const emitted: { startAt: string; endAt: string }[] = [];
    fixture.componentInstance.previewRequested.subscribe((e) => emitted.push(e));
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10' }));
    fixture.componentInstance.onDurationChange('half');
    fixture.detectChanges();
    expect(emitted.at(-1)).toMatchObject({ startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-10T13:00:00.000Z' });
    fixture.componentInstance.half.set('second');
    fixture.detectChanges();
    expect(emitted.at(-1)).toMatchObject({ startAt: '2026-09-10T14:00:00.000Z', endAt: '2026-09-10T18:00:00.000Z' });
  });

  it('Half Day keeps to one date and takes the first or second half of the work window', () => {
    const emitted: { startAt: string; endAt: string }[] = [];
    fixture.componentInstance.previewRequested.subscribe((e) => emitted.push(e));
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.onDurationChange('half');
    fixture.detectChanges();
    expect(fixture.componentInstance.draft().endDate).toBe('2026-09-10');
    expect(emitted.at(-1)).toMatchObject({ startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-10T13:30:00.000Z' });

    fixture.componentInstance.half.set('second');
    fixture.detectChanges();
    expect(emitted.at(-1)).toMatchObject({ startAt: '2026-09-10T13:30:00.000Z', endAt: '2026-09-10T18:00:00.000Z' });

    fixture.componentInstance.onStartDateChange('2026-09-15');
    expect(fixture.componentInstance.draft().endDate).toBe('2026-09-15');
  });

  it('lets Custom Hours submit without a work window', () => {
    fixture.componentRef.setInput('workStartTime', null);
    fixture.componentRef.setInput('workEndTime', null);
    fixture.detectChanges();
    fixture.componentInstance.onDurationChange('custom');
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-10', startTime: '10:00', endTime: '12:00' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="work-window-required"]')).toBeNull();
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('shows chargeable hours and the balance after the request from the preview', () => {
    fixture.componentRef.setInput('previewResult', preview({ totalHours: 16, balanceImpact: { currentRemainingHours: 96, pendingAfterSubmitHours: 16, remainingAfterSubmitHours: 80 } }));
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('[data-testid="request-summary"]') as HTMLElement;
    expect(summary.textContent).toContain('16 h');
    expect(summary.textContent).toContain('80 h');
    expect(summary.textContent).toContain('Annual Leave balance');
  });

  it('names the first approver once the preview knows them', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="approver-note"]')?.textContent).toContain('your manager');
    fixture.componentRef.setInput('previewResult', preview({ approvers: [{ approverEmployeeId: 'm-1', approverName: 'Priya Nair', sequenceOrder: 1, status: 'pending', delegatedFromApproverId: null }] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="approver-note"]')?.textContent).toContain('Priya Nair');
  });
});

describe('halfDayWindows', () => {
  it('gives each half half of the working hours, with the break between them', () => {
    expect(halfDayWindows('09:00', '18:00', 60)).toEqual({ first: ['09:00', '13:00'], second: ['14:00', '18:00'] });
    expect(halfDayWindows('08:00', '16:00', null)).toEqual({ first: ['08:00', '12:00'], second: ['12:00', '16:00'] });
  });

  it('handles a window that runs past midnight', () => {
    expect(halfDayWindows('22:00', '06:00', 0)).toEqual({ first: ['22:00', '02:00'], second: ['02:00', '06:00'] });
  });
});
