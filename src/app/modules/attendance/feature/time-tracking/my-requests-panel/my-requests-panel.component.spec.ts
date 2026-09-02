import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../../core/services/notification.service';
import { AttendanceCorrectionResponse } from '../../../models/attendance-correction.model';
import { WorkAreaChangeRequestResponse } from '../../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { MyRequestsPanelComponent } from './my-requests-panel.component';

const correction: AttendanceCorrectionResponse = {
  id: 'correction-1',
  employeeId: 'employee-1',
  workDate: '2026-08-21',
  correctionType: 'clock_in',
  requestedClockInAt: '2026-08-21T04:00:00Z',
  requestedClockOutAt: null,
  requestedBreaks: null,
  reason: 'Forgot to clock in',
  notes: null,
  status: 'pending',
  timezone: 'Asia/Colombo',
  reviewedAt: null,
  reviewComment: null
} as AttendanceCorrectionResponse;

const workAreaRequest: WorkAreaChangeRequestResponse = {
  id: 'wa-1',
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  requesterDisplayName: 'Requester',
  timezone: 'Asia/Colombo',
  date: '2026-08-22',
  currentExpectedWorkArea: 'onsite',
  requestedWorkArea: 'remote',
  reason: 'Client meeting',
  status: 'pending',
  requestedAt: '2026-08-21T06:00:00.000Z',
  reviewedById: null,
  reviewerDisplayName: null,
  reviewedAt: null,
  reviewComment: null,
  receiver: { employeeId: 'approver-1', userId: 'user-1', displayName: 'Approver', positionName: 'Manager' }
};

interface PanelStoreMock {
  myCorrections: ReturnType<typeof signal<readonly AttendanceCorrectionResponse[]>>;
  myCorrectionsLoading: ReturnType<typeof signal<boolean>>;
  myCorrectionsError: ReturnType<typeof signal<string | null>>;
  myCorrectionsPage: ReturnType<typeof signal<number>>;
  myCorrectionsPageSize: ReturnType<typeof signal<number>>;
  myCorrectionsTotalCount: ReturnType<typeof signal<number>>;
  myCorrectionsLoaded: ReturnType<typeof signal<boolean>>;
  correctionActionLoading: ReturnType<typeof signal<boolean>>;
  activeCorrectionAction: ReturnType<typeof signal<string | null>>;
  loadMyCorrections: ReturnType<typeof vi.fn>;
  cancelCorrection: ReturnType<typeof vi.fn>;
  myWorkAreaRequests: ReturnType<typeof signal<readonly WorkAreaChangeRequestResponse[]>>;
  myWorkAreaRequestsLoading: ReturnType<typeof signal<boolean>>;
  myWorkAreaRequestsError: ReturnType<typeof signal<string | null>>;
  myWorkAreaRequestsPage: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsPageSize: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsTotalCount: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsLoaded: ReturnType<typeof signal<boolean>>;
  workAreaActionLoading: ReturnType<typeof signal<boolean>>;
  activeWorkAreaRequestId: ReturnType<typeof signal<string | null>>;
  loadMyWorkAreaRequests: ReturnType<typeof vi.fn>;
  cancelWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
}

describe('MyRequestsPanelComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    corrections?: readonly AttendanceCorrectionResponse[];
    workAreaRequests?: readonly WorkAreaChangeRequestResponse[];
    autoLoad?: boolean;
  } = {}): Promise<{ fixture: ComponentFixture<MyRequestsPanelComponent>; store: PanelStoreMock }> {
    const store: PanelStoreMock = {
      myCorrections: signal(options.corrections ?? []),
      myCorrectionsLoading: signal(false),
      myCorrectionsError: signal(null),
      myCorrectionsPage: signal(1),
      myCorrectionsPageSize: signal(20),
      myCorrectionsTotalCount: signal((options.corrections ?? []).length),
      myCorrectionsLoaded: signal(false),
      correctionActionLoading: signal(false),
      activeCorrectionAction: signal(null),
      loadMyCorrections: vi.fn(() => Promise.resolve()),
      cancelCorrection: vi.fn(() => Promise.resolve(correction)),
      myWorkAreaRequests: signal(options.workAreaRequests ?? []),
      myWorkAreaRequestsLoading: signal(false),
      myWorkAreaRequestsError: signal(null),
      myWorkAreaRequestsPage: signal(1),
      myWorkAreaRequestsPageSize: signal(20),
      myWorkAreaRequestsTotalCount: signal((options.workAreaRequests ?? []).length),
      myWorkAreaRequestsLoaded: signal(false),
      workAreaActionLoading: signal(false),
      activeWorkAreaRequestId: signal(null),
      loadMyWorkAreaRequests: vi.fn(() => Promise.resolve()),
      cancelWorkAreaChangeRequest: vi.fn(() => Promise.resolve({ ...workAreaRequest, status: 'cancelled' }))
    };

    await TestBed.configureTestingModule({
      imports: [MyRequestsPanelComponent],
      providers: [
        { provide: TimeTrackingStore, useValue: store },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyRequestsPanelComponent);
    fixture.componentRef.setInput('autoLoad', options.autoLoad ?? true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  it('loads corrections on init (the default tab)', async () => {
    const { store } = await setup();
    expect(store.loadMyCorrections).toHaveBeenCalled();
  });

  it('does not auto-load when autoLoad is false', async () => {
    const { store } = await setup({ autoLoad: false });
    expect(store.loadMyCorrections).not.toHaveBeenCalled();
    expect(store.loadMyWorkAreaRequests).not.toHaveBeenCalled();
  });

  it('switches to the work-area tab and loads it on first visit', async () => {
    const { fixture, store } = await setup();
    const workAreaTab = fixture.nativeElement.querySelector('#my-requests-tab-work-area') as HTMLButtonElement;
    workAreaTab.click();
    fixture.detectChanges();
    expect(store.loadMyWorkAreaRequests).toHaveBeenCalledWith({ pageNumber: 1 });
  });

  it('renders the corrections table and cancels a pending request', async () => {
    const { fixture, store } = await setup({ corrections: [correction] });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Forgot to clock in');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.table-action--danger')!.click();
    await fixture.whenStable();

    expect(store.cancelCorrection).toHaveBeenCalledWith('correction-1');
  });

  it('opens the cancel-work-area confirmation modal and confirms it', async () => {
    const { fixture, store } = await setup({ workAreaRequests: [workAreaRequest] });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#my-requests-tab-work-area')!.click();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.table-action--danger')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cancel work-area request?');

    const confirmButtons = Array.from(fixture.nativeElement.querySelectorAll('.modal-actions button')) as HTMLButtonElement[];
    confirmButtons.find((button) => button.textContent?.trim() === 'Cancel request')!.click();
    await fixture.whenStable();

    expect(store.cancelWorkAreaChangeRequest).toHaveBeenCalledWith('wa-1');
  });

  it("formats a correction request's clock-in and clock-out using the response's own timezone", async () => {
    const request = correctionResponse({
      timezone: 'Asia/Colombo',
      requestedClockInAt: '2026-08-22T09:00:00Z',
      requestedClockOutAt: '2026-08-22T17:00:00Z'
    });
    const { fixture } = await setup({ corrections: [request] });
    const component = fixture.componentInstance;
    const correctionsRow = fixture.nativeElement.querySelector('.corrections-table tbody tr') as HTMLElement;

    expect(component.correctionSummary(request)).toBe(
      `${formatForTimezone(request.requestedClockInAt!, 'Asia/Colombo')} to ${formatForTimezone(request.requestedClockOutAt!, 'Asia/Colombo')}`
    );
    expect(component.correctionSummary(request)).not.toContain(formatForTimezone(request.requestedClockInAt!, 'America/New_York'));
    expect(correctionsRow.textContent).toContain(component.correctionSummary(request));
  });

  it('handles invalid correction timezones and null correction timestamps without throwing or exposing raw timezone errors', async () => {
    const invalid = correctionResponse({
      timezone: 'Invalid/CorrectionTimezone',
      requestedClockInAt: '2026-08-22T09:00:00Z',
      requestedClockOutAt: null,
      reviewedAt: null
    });
    const empty = correctionResponse({
      timezone: 'Asia/Colombo',
      requestedClockInAt: null,
      requestedClockOutAt: null,
      reviewedAt: null
    });
    const { fixture } = await setup({ corrections: [invalid, empty] });
    const component = fixture.componentInstance;

    expect(() => component.correctionSummary(invalid)).not.toThrow();
    expect(component.correctionSummary(invalid)).toBe('—');
    expect(component.correctionSummary(empty)).toBe('Time update requested');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Invalid/CorrectionTimezone');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('RangeError');
  });
});

function correctionResponse(overrides: Partial<AttendanceCorrectionResponse> = {}): AttendanceCorrectionResponse {
  return {
    id: 'correction-1',
    employeeId: 'employee-1',
    legalEntityId: 'entity-1',
    timezone: 'Asia/Colombo',
    workDate: '2026-08-22',
    correctionType: 'clock_in',
    requestedClockInAt: '2026-08-22T09:00:00Z',
    requestedClockOutAt: null,
    requestedBreaks: null,
    reason: 'Forgot to clock in.',
    notes: null,
    status: 'pending',
    approvalRequired: true,
    requestedById: 'user-1',
    reviewedById: null,
    reviewedAt: null,
    reviewComment: null,
    approver: null,
    requesterDisplayName: 'Alex Employee',
    ...overrides
  } as AttendanceCorrectionResponse;
}

function formatForTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  }).format(new Date(value));
}
