import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AttendanceCorrectionResponse } from '../../models/attendance-correction.model';
import { AttendanceHistoryRow, AttendanceTodayResponse } from '../../models/time-tracking.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { TimeTrackingComponent } from './time-tracking.component';

const today: AttendanceTodayResponse = {
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  workDate: '2026-08-22',
  timezone: 'Asia/Colombo',
  scheduleStatus: 'configured',
  policyStatus: 'configured',
  isWorkingDay: true,
  isHoliday: false,
  holidayName: null,
  scheduledStartTime: '09:00',
  scheduledEndTime: '17:30',
  requiredWorkMinutes: 480,
  breakAllowanceMinutes: 60,
  breakUsedMinutes: 0,
  breakRemainingMinutes: 60,
  breakState: 'available',
  expectedWorkMode: 'onsite',
  attendanceStatus: 'not_clocked_in',
  clockInAt: null,
  clockOutAt: null,
  totalWorkedMinutes: 0,
  attendanceSource: null,
  canClockIn: true,
  canClockOut: false,
  canStartBreak: false,
  canEndBreak: false,
  shouldHaveClockedIn: false,
  canViewCoveredEmployees: false,
  allowedClockInMethods: {
    web: true,
    desktopTray: false,
    biometric: false,
    photoRequired: false,
    locationRequired: false,
    allowedRadiusMeters: null
  },
  messages: [],
  attendanceStatusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

const coveredRow: AttendanceHistoryRow = {
  attendanceRecordId: 'record-1',
  workDate: '2026-08-22',
  employee: {
    employeeId: 'employee-2',
    displayName: 'Jordan Lee',
    employeeNumber: 'EMP-002',
    position: 'Designer',
    department: 'Product',
    avatarFileId: null
  },
  clockInAt: '2026-08-22T09:05:00+05:30',
  clockOutAt: null,
  isActive: true,
  breakMinutes: 0,
  totalWorkedMinutes: 120,
  expectedWorkMode: 'remote',
  attendanceSource: 'web',
  status: 'clocked_in',
  canViewDetails: true,
  canRequestCorrection: false,
  canRequestWorkAreaChange: false,
  canCorrect: false,
  statusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

type StoreMock = {
  today: ReturnType<typeof signal<AttendanceTodayResponse | null>>;
  todayLoading: ReturnType<typeof signal<boolean>>;
  todayError: ReturnType<typeof signal<string | null>>;
  actionLoading: ReturnType<typeof signal<boolean>>;
  activeAction: ReturnType<typeof signal<null>>;
  history: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  historyLoading: ReturnType<typeof signal<boolean>>;
  historyError: ReturnType<typeof signal<string | null>>;
  coveredHistory: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  coveredHistoryLoading: ReturnType<typeof signal<boolean>>;
  coveredHistoryError: ReturnType<typeof signal<string | null>>;
  selectedHistoryRange: ReturnType<typeof signal<{ from: string; to: string } | null>>;
  selectedCoveredEmployeeId: ReturnType<typeof signal<string | null>>;
  loadToday: ReturnType<typeof vi.fn>;
  loadMyHistory: ReturnType<typeof vi.fn>;
  loadCoveredHistory: ReturnType<typeof vi.fn>;
  clockIn: ReturnType<typeof vi.fn>;
  startBreak: ReturnType<typeof vi.fn>;
  endBreak: ReturnType<typeof vi.fn>;
  clockOut: ReturnType<typeof vi.fn>;
  myCorrections: ReturnType<typeof signal<readonly AttendanceCorrectionResponse[]>>;
  myCorrectionsLoading: ReturnType<typeof signal<boolean>>;
  myCorrectionsError: ReturnType<typeof signal<string | null>>;
  loadMyCorrections: ReturnType<typeof vi.fn>;
  cancelCorrection: ReturnType<typeof vi.fn>;
};

describe('TimeTrackingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    overrides: Partial<AttendanceTodayResponse> = {},
    access = false,
    history: readonly AttendanceHistoryRow[] = [],
    corrections: readonly AttendanceCorrectionResponse[] = []
  ): Promise<{ fixture: ComponentFixture<TimeTrackingComponent>; store: StoreMock }> {
    const store: StoreMock = {
      today: signal({ ...today, ...overrides }),
      todayLoading: signal(false),
      todayError: signal(null),
      actionLoading: signal(false),
      activeAction: signal(null),
      history: signal(history),
      historyLoading: signal(false),
      historyError: signal(null),
      coveredHistory: signal(access ? history : []),
      coveredHistoryLoading: signal(false),
      coveredHistoryError: signal(null),
      selectedHistoryRange: signal(null),
      selectedCoveredEmployeeId: signal(null),
      loadToday: vi.fn(() => Promise.resolve()),
      loadMyHistory: vi.fn(() => Promise.resolve()),
      loadCoveredHistory: vi.fn(() => Promise.resolve()),
      clockIn: vi.fn(() => Promise.resolve()),
      startBreak: vi.fn(() => Promise.resolve()),
      endBreak: vi.fn(() => Promise.resolve()),
      clockOut: vi.fn(() => Promise.resolve()),
      myCorrections: signal(corrections),
      myCorrectionsLoading: signal(false),
      myCorrectionsError: signal(null),
      loadMyCorrections: vi.fn(() => Promise.resolve()),
      cancelCorrection: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [TimeTrackingComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: PermissionService, useValue: { hasPermission: vi.fn(() => access) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TimeTrackingComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('formats Today clock-in and clock-out using the backend timezone', async () => {
    const clockIn = '2026-08-22T09:00:00Z';
    const clockOut = '2026-08-22T17:00:00Z';
    const { fixture } = await setup({
      timezone: 'Asia/Colombo',
      clockInAt: clockIn,
      clockOutAt: clockOut
    });
    const component = fixture.componentInstance;
    const expectedClockIn = formatForTimezone(clockIn, 'Asia/Colombo');
    const expectedClockOut = formatForTimezone(clockOut, 'Asia/Colombo');
    const browserIndependentUtcClockIn = formatForTimezone(clockIn, 'UTC');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(component.formatDateTime(clockIn, 'Asia/Colombo')).toBe(expectedClockIn);
    expect(component.formatDateTime(clockOut, 'Asia/Colombo')).toBe(expectedClockOut);
    expect(expectedClockIn).not.toBe(browserIndependentUtcClockIn);
    expect(text).toContain(expectedClockIn);
    expect(text).toContain(expectedClockOut);
  });

  it('uses Today.timezone for personal history row timestamps', async () => {
    const row = {
      ...coveredRow,
      clockInAt: '2026-08-22T09:00:00Z',
      clockOutAt: '2026-08-22T17:00:00Z'
    };
    const { fixture } = await setup({ timezone: 'Asia/Colombo' }, false, [row]);
    const rowText = fixture.nativeElement.querySelector('table tbody tr')?.textContent ?? '';

    expect(rowText).toContain(formatForTimezone(row.clockInAt, 'Asia/Colombo'));
    expect(rowText).toContain(formatForTimezone(row.clockOutAt, 'Asia/Colombo'));
    expect(rowText).not.toContain(formatForTimezone(row.clockInAt, 'UTC'));
  });

  it('uses Today.timezone for covered history row timestamps', async () => {
    const row = {
      ...coveredRow,
      clockInAt: '2026-08-22T09:00:00Z',
      clockOutAt: '2026-08-22T17:00:00Z'
    };
    const { fixture } = await setup({ timezone: 'Asia/Colombo', canViewCoveredEmployees: true }, true, [row]);
    const tables = fixture.nativeElement.querySelectorAll('table');
    const teamRowText = tables[1]?.querySelector('tbody tr')?.textContent ?? '';

    expect(teamRowText).toContain(formatForTimezone(row.clockInAt, 'Asia/Colombo'));
    expect(teamRowText).toContain(formatForTimezone(row.clockOutAt, 'Asia/Colombo'));
    expect(teamRowText).not.toContain(formatForTimezone(row.clockInAt, 'UTC'));
  });

  it('formats My correction request clock-in and clock-out using the response timezone, not Today timezone', async () => {
    const request = correctionResponse({
      timezone: 'Asia/Colombo',
      requestedClockInAt: '2026-08-22T09:00:00Z',
      requestedClockOutAt: '2026-08-22T17:00:00Z'
    });
    const { fixture } = await setup({ timezone: 'America/New_York' }, false, [], [request]);
    const component = fixture.componentInstance;
    const correctionsRow = fixture.nativeElement.querySelector('.corrections-table tbody tr') as HTMLElement;

    expect(component.correctionSummary(request)).toBe(
      `${formatForTimezone(request.requestedClockInAt!, 'Asia/Colombo')} to ${formatForTimezone(request.requestedClockOutAt!, 'Asia/Colombo')}`
    );
    expect(component.correctionSummary(request)).not.toContain(formatForTimezone(request.requestedClockInAt!, 'America/New_York'));
    expect(correctionsRow.textContent).toContain(component.correctionSummary(request));
  });

  it('formats the reviewed correction timestamp using the response timezone', async () => {
    const request = correctionResponse({
      timezone: 'Asia/Colombo',
      status: 'approved',
      reviewedAt: '2026-08-22T18:00:00Z'
    });
    const { fixture } = await setup({ timezone: 'America/New_York' }, false, [], [request]);
    const reviewText = (fixture.nativeElement.querySelector('.corrections-table tbody tr') as HTMLElement).textContent ?? '';

    expect(reviewText).toContain(`Reviewed ${formatForTimezone(request.reviewedAt!, 'Asia/Colombo')}`);
    expect(reviewText).not.toContain(formatForTimezone(request.reviewedAt!, 'America/New_York'));
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
    const { fixture } = await setup({ timezone: 'America/New_York' }, false, [], [invalid, empty]);
    const component = fixture.componentInstance;

    expect(() => component.correctionSummary(invalid)).not.toThrow();
    expect(component.correctionSummary(invalid)).toBe('—');
    expect(component.correctionSummary(empty)).toBe('Time update requested');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Invalid/CorrectionTimezone');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('RangeError');
  });

  it('returns an em dash for invalid timezone and null or invalid timestamps without throwing', async () => {
    const { fixture } = await setup({
      timezone: 'Invalid/LegalEntityTimezone',
      clockInAt: 'not-a-timestamp',
      clockOutAt: '2026-08-22T17:00:00Z'
    });
    const component = fixture.componentInstance;

    expect(() => component.formatDateTime('2026-08-22T09:00:00Z', 'Invalid/LegalEntityTimezone')).not.toThrow();
    expect(component.formatDateTime('2026-08-22T09:00:00Z', 'Invalid/LegalEntityTimezone')).toBe('—');
    expect(component.formatDateTime('not-a-timestamp', 'Asia/Colombo')).toBe('—');
    expect(component.formatDateTime(null, 'Asia/Colombo')).toBe('—');
  });

  it('shows only the actions enabled by the backend response flags', async () => {
    const { fixture } = await setup({
      canClockIn: false,
      canStartBreak: true,
      canEndBreak: false,
      canClockOut: true
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="clock-in"]')).toBeNull();
    expect(element.querySelector('[data-testid="start-break"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="end-break"]')).toBeNull();
    expect(element.querySelector('[data-testid="clock-out"]')).toBeTruthy();
  });

  it('shows remaining break time and the used-break helper when remaining is zero', async () => {
    const { fixture } = await setup({ breakUsedMinutes: 60, breakRemainingMinutes: 0 });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('0m remaining');
    expect(text).toContain('You have used your break time for today.');
  });

  it('uses the backend Today status label and falls back to the humanized status', async () => {
    const { fixture } = await setup({ attendanceStatus: 'on_time_off', attendanceStatusLabel: 'On approved time off' });
    const component = fixture.componentInstance;

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('On approved time off');
    expect(component.statusLabel('not_clocked_in', null)).toBe('Not clocked in');
    expect(component.statusLabel('not_clocked_in', '  ')).toBe('Not clocked in');
  });

  it('renders the backend attention label without exposing its machine type and applies severity styling', async () => {
    const { fixture } = await setup({
      attentionType: 'worked_during_time_off',
      attentionLabel: 'Worked during approved time off',
      attentionSeverity: 'warning'
    });
    const element = fixture.nativeElement as HTMLElement;
    const banner = element.querySelector('.attention-banner');

    expect(banner?.textContent).toContain('Worked during approved time off');
    expect(banner?.classList.contains('attention-banner--warning')).toBe(true);
    expect(element.textContent).not.toContain('worked_during_time_off');
  });

  it('shows the missed clock-in warning only when no backend attention label exists', async () => {
    const { fixture, store } = await setup({ shouldHaveClockedIn: true, attentionLabel: null });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('You have not clocked in yet.');

    store.today.set({
      ...today,
      shouldHaveClockedIn: true,
      attentionType: 'not_clocked_in',
      attentionLabel: 'Still has not clocked in',
      attentionSeverity: 'critical'
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Still has not clocked in');
    expect(text).not.toContain('You have not clocked in yet.');
  });

  it('keeps Clock in available for a leave or non-working-day response when the backend allows it', async () => {
    const { fixture } = await setup({
      attendanceStatus: 'non_working_day',
      attendanceStatusLabel: 'Non-working day',
      isWorkingDay: false,
      canClockIn: true
    });
    expect(fixture.nativeElement.querySelector('[data-testid="clock-in"]')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('You have not clocked in yet.');
  });

  it('shows break overage while preserving used duration and never renders negative remaining time', async () => {
    const { fixture } = await setup({
      breakAllowanceMinutes: 30,
      breakUsedMinutes: 45,
      breakRemainingMinutes: 0,
      breakOverageMinutes: 15,
      isOverBreakAllowance: true,
      canEndBreak: true
    });
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Break time exceeded by 15 min.');
    expect(text).toContain('30m allowance · 45m used');
    expect(text).not.toContain('-15m');
    expect(element.querySelector('[data-testid="end-break"]')).toBeTruthy();
  });

  it('uses backend history labels and shows attention and break overage for personal and covered rows', async () => {
    const row = {
      ...coveredRow,
      status: 'worked_during_time_off',
      statusLabel: 'Worked during time off',
      attentionType: 'worked_during_time_off',
      attentionLabel: 'Worked during approved time off',
      attentionSeverity: 'warning',
      breakOverageMinutes: 12,
      isOverBreakAllowance: true
    };
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [row]);
    const tables = fixture.nativeElement.querySelectorAll('table');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Worked during time off');
    expect(text).toContain('Worked during approved time off');
    expect(text).toContain('Break exceeded by 12 min');
    expect(text).not.toContain('worked_during_time_off');
    expect(tables).toHaveLength(2);
  });

  it('humanizes common backend message values instead of rendering machine codes', async () => {
    const { fixture } = await setup({
      messages: ['schedule_not_configured', 'policy_not_configured', 'break_allowance_used', 'already_clocked_out']
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Your work schedule is not configured for today.');
    expect(text).toContain('Your attendance policy is not configured.');
    expect(text).toContain('You have used your break time for today.');
    expect(text).toContain('You have already clocked out today.');
    expect(text).not.toContain('schedule_not_configured');
    expect(text).not.toContain('policy_not_configured');
  });

  it('hides team attendance without attendance:read', async () => {
    const { fixture } = await setup({}, false, [coveredRow]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Team attendance');
  });

  it('shows team attendance with attendance:read', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [coveredRow]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Team attendance');
    expect(text).toContain('Jordan Lee');
  });
  it('shows Request correction only when the history row allows it', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true };
    const hidden = { ...eligible, attendanceRecordId: 'record-2', canRequestCorrection: false };
    const { fixture } = await setup({}, false, [eligible, hidden]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="request-correction"]')).toHaveLength(1);
  });

  it('opens the correction form with the selected work date and clock-in fields', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true, workDate: '2026-08-21' };
    const { fixture } = await setup({}, false, [eligible]);
    (fixture.nativeElement.querySelector('[data-testid="request-correction"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Request attendance correction');
    expect(text).toContain('Aug 21, 2026');
    expect(text).toContain('Times are shown in company time.');
    expect(text).not.toContain('Times use Asia/Colombo.');
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeNull();
  });

  it('shows the correction-specific fields for break and full-day requests', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true };
    const { fixture } = await setup({}, false, [eligible]);
    const component = fixture.componentInstance;
    component.openCorrection(eligible);
    component.correctionType.set('break');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Break start time"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeNull();

    component.correctionType.set('full_day');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeTruthy();
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
  };
}

function formatForTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  }).format(new Date(value));
}
