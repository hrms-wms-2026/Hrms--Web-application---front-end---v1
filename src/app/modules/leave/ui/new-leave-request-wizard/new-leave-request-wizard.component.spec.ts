import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { LegalEntityGeneralSettings } from '../../../organization/models/legal-entity.model';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { NewLeaveRequestWizardComponent } from './new-leave-request-wizard.component';

describe('NewLeaveRequestWizardComponent', () => {
  let fixture: ComponentFixture<NewLeaveRequestWizardComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0, isActive: true, createdAt: '2026-08-21T00:00:00Z' }
  ];
  const balances: LeaveBalanceResponse[] = [
    { employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, entitledHours: 20, annualHours: 20, carriedForwardHours: 0, usedHours: 5, pendingHours: 0, remainingHours: 15, isNegative: false, carryForwardExpiresOn: null }
  ];
  const previewResult: LeaveRequestResponse = {
    id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
    startAt: '2026-09-09T14:00:00.000Z', endAt: '2026-09-09T18:00:00.000Z', totalHours: 4, paidHours: 4, unpaidHours: 0,
    status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
    balanceImpact: { currentRemainingHours: 15, pendingAfterSubmitHours: 4, remainingAfterSubmitHours: 11 },
    approvers: [], conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
    createdAt: '2026-08-25T00:00:00Z'
  };

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

  afterEach(() => {
    TestBed.inject(GeneralSettingsStore).clear();
  });

  it('shows remaining hours next to each leave type option', () => {
    fixture.detectChanges();
    const options: HTMLOptionElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="leave-type-select"] option'));
    expect(options.some((o) => o.textContent?.includes('Annual Leave') && o.textContent?.includes('15 hours remaining'))).toBe(true);
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

  it('does not render a half-day period select', () => {
    fixture.detectChanges();
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Half day');
    expect(fixture.nativeElement.querySelector('[data-testid="half-day-select"]')).toBeNull();
  });

  it('renders From/To date and time pickers on step 2', () => {
    fixture.detectChanges();
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-date-picker')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-time-picker')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('From date');
    expect(fixture.nativeElement.textContent).toContain('From time');
    expect(fixture.nativeElement.textContent).toContain('To date');
    expect(fixture.nativeElement.textContent).toContain('To time');
  });

  it('emits ISO startAt/endAt for an afternoon window with no halfDayPeriod', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-09',
      startTime: '14:00',
      endDate: '2026-09-09',
      endTime: '18:00'
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
    expect(emitted[0] as object).not.toHaveProperty('halfDayPeriod');
  });

  it('defaults empty times to the work window when converting to ISO', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-09',
      startTime: '',
      endDate: '2026-09-09',
      endTime: ''
    }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T09:00:00.000Z',
      endAt: '2026-09-09T18:00:00.000Z',
      reason: null,
      fileRecordIds: []
    }]);
  });

  it('bumps the end date by one calendar day when overnight times share a date', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-09',
      startTime: '22:00',
      endDate: '2026-09-09',
      endTime: '06:00'
    }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T22:00:00.000Z',
      endAt: '2026-09-10T06:00:00.000Z',
      reason: null,
      fileRecordIds: []
    }]);
  });

  it('converts wall-clock times using the timezone input when the settings store has none', () => {
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-09',
      startTime: '14:00',
      endDate: '2026-09-09',
      endTime: '18:00'
    }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T08:30:00.000Z',
      endAt: '2026-09-09T12:30:00.000Z',
      reason: null,
      fileRecordIds: []
    }]);
  });

  it('prefers GeneralSettingsStore timezone over the timezone input', () => {
    const settings: LegalEntityGeneralSettings = {
      id: 'company-a', name: 'Company A', companyCode: 'A', logoFileId: null,
      registrationNumber: 'REG-A', taxRegistrationNumber: null, vatGstNumber: null,
      email: null, phoneNumber: null, website: null, countryCode: 'LKA', currencyCode: 'LKR',
      timezone: 'Asia/Colombo', financialYearStartMonth: 1, firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5], defaultLanguage: 'en', dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h', status: 'active', workStartTime: '09:00', workEndTime: '18:00',
      breakDurationMinutes: 60, officeAddress: null, officeLatitude: null, officeLongitude: null
    };
    patchState(TestBed.inject(GeneralSettingsStore) as Parameters<typeof patchState>[0], { settings });
    fixture.componentRef.setInput('timezone', 'UTC');
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-09',
      startTime: '14:00',
      endDate: '2026-09-09',
      endTime: '18:00'
    }));
    expect(fixture.componentInstance.toSubmitPayload()).toEqual({
      leaveTypeId: 'type-1',
      startAt: '2026-09-09T08:30:00.000Z',
      endAt: '2026-09-09T12:30:00.000Z',
      reason: null,
      fileRecordIds: []
    });
  });

  it('disables Continue on step 2 and shows a settings message when work start is unset', () => {
    fixture.componentRef.setInput('workStartTime', null);
    fixture.componentRef.setInput('workEndTime', null);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-09', endDate: '2026-09-09' }));
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    expect(fixture.componentInstance.canLeaveStep(2)).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Set work start and end in General Settings first.');
    const continueBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.nlw-primary');
    expect(continueBtn.disabled).toBe(true);
  });

  it('shows total leave hours on the preview step', () => {
    fixture.componentRef.setInput('previewResult', previewResult);
    fixture.detectChanges();
    fixture.componentInstance.step.set(3);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Total leave hours:');
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('shows remaining hours before and after submit on the review step', () => {
    fixture.componentRef.setInput('previewResult', previewResult);
    fixture.detectChanges();
    fixture.componentInstance.step.set(5);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('15');
    expect(fixture.nativeElement.textContent).toContain('11');
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
      ...d,
      leaveTypeId: 'type-1',
      startDate: '2026-09-10',
      startTime: '',
      endDate: '2026-09-12',
      endTime: '',
      reason: 'Trip'
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
});
