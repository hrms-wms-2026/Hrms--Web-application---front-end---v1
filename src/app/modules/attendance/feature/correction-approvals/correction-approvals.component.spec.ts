import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { AttendanceCorrectionResponse } from '../../models/attendance-correction.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { CorrectionApprovalsComponent } from './correction-approvals.component';

const pending: AttendanceCorrectionResponse = {
  id: 'correction-1', employeeId: 'employee-1', legalEntityId: 'entity-1', timezone: 'Asia/Colombo', workDate: '2026-08-21', correctionType: 'full_day',
  requestedClockInAt: '2026-08-21T03:30:00.000Z', requestedClockOutAt: '2026-08-21T12:00:00.000Z', requestedBreaks: null,
  reason: 'Forgot to clock in and out', notes: 'Worked the scheduled shift', status: 'pending', approvalRequired: true,
  requestedById: 'user-1', reviewedById: null, reviewedAt: null, reviewComment: null, approver: null, requesterDisplayName: 'Jordan Lee'
};

describe('CorrectionApprovalsComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(items: readonly AttendanceCorrectionResponse[] = [pending]) {
    const store = {
      approvalInbox: signal(items), approvalInboxLoading: signal(false), approvalInboxError: signal<string | null>(null),
      approvalInboxLoaded: signal(false),
      correctionActionLoading: signal(false), activeCorrectionAction: signal<string | null>(null),
      loadApprovalInbox: vi.fn(() => Promise.resolve()),
      approveCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'approved' })),
      rejectCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'rejected' }))
    };
    const notifications = { success: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CorrectionApprovalsComponent],
      providers: [provideRouter([]), { provide: TimeTrackingStore, useValue: store }, { provide: NotificationService, useValue: notifications }]
    }).compileComponents();
    const fixture = TestBed.createComponent(CorrectionApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, store, notifications };
  }

  it('loads and renders pending approval requests from the store', async () => {
    const { fixture, store } = await setup();
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Full day');
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });

  it('formats approval times using the response timezone instead of the browser timezone', async () => {
    const { component } = await setup();
    const expectedIn = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(pending.requestedClockInAt!));
    const expectedOut = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(pending.requestedClockOutAt!));
    const browserFormatted = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(pending.requestedClockInAt!));

    expect(expectedIn).not.toBe(browserFormatted);
    expect(component.correctionSummary(pending)).toBe(`${expectedIn} to ${expectedOut}`);
    expect(component.correctionSummary(pending)).not.toContain(`${browserFormatted} to`);
  });

  it('does not throw for invalid timezones and null timestamps', async () => {
    const { component } = await setup();
    const invalidTimezone = { ...pending, timezone: 'Invalid/Timezone', requestedClockInAt: 'not-a-date' };
    const nullTimestamp = { ...pending, requestedClockInAt: null, requestedClockOutAt: null };

    expect(() => component.correctionSummary(invalidTimezone)).not.toThrow();
    expect(component.correctionSummary(invalidTimezone)).toBe('Time update requested');
    expect(component.correctionSummary(nullTimestamp)).toBe('Time update requested');
    expect(component.formatDateTime(null, pending.timezone)).toBe('—');
  });

  it('formats requested break intervals using the response timezone', async () => {
    const { component } = await setup();
    const request: AttendanceCorrectionResponse = {
      ...pending,
      correctionType: 'break',
      requestedClockInAt: null,
      requestedClockOutAt: null,
      requestedBreaks: [{ breakStart: '2026-08-21T06:00:00.000Z', breakEnd: '2026-08-21T06:30:00.000Z', breakType: 'other' }]
    };

    const summary = component.correctionSummary(request);
    expect(summary).toContain('1 break interval(s):');
    expect(summary).toContain(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(request.requestedBreaks![0].breakStart)));
  });

  it('does not allow rejection without a review comment', async () => {
    const { component, store } = await setup();
    component.openReview(pending);
    await component.review('reject');
    expect(store.rejectCorrection).not.toHaveBeenCalled();
    expect(component.reviewError()).toContain('Add a reason');
  });

  it('approves a pending request and refreshes the inbox', async () => {
    const { component, store, notifications } = await setup();
    component.openReview(pending);
    await component.review('approve');
    expect(store.approveCorrection).toHaveBeenCalledWith('correction-1', { reviewComment: null });
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(2);
    expect(notifications.success).toHaveBeenCalledWith('Attendance correction approved.');
  });

  it('hides the breadcrumb and page heading when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('#approvals-heading')).toBeNull();
  });

  it('still shows the breadcrumb and heading when not embedded', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#approvals-heading')?.textContent).toContain('Attendance correction approvals');
  });

  it('does not re-fetch the inbox on init when the store already has a loaded inbox', async () => {
    await TestBed.resetTestingModule();
    const store = {
      approvalInbox: signal([pending]), approvalInboxLoading: signal(false), approvalInboxError: signal<string | null>(null),
      approvalInboxLoaded: signal(true),
      correctionActionLoading: signal(false), activeCorrectionAction: signal<string | null>(null),
      loadApprovalInbox: vi.fn(() => Promise.resolve()),
      approveCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'approved' })),
      rejectCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'rejected' }))
    };
    await TestBed.configureTestingModule({
      imports: [CorrectionApprovalsComponent],
      providers: [provideRouter([]), { provide: TimeTrackingStore, useValue: store }, { provide: NotificationService, useValue: { success: vi.fn() } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(CorrectionApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadApprovalInbox).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('still fetches on init when the store has no loaded inbox yet', async () => {
    const { store } = await setup();
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(1);
  });
});
