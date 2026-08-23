import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
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
  messages: []
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
  canCorrect: false
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
};

describe('TimeTrackingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    overrides: Partial<AttendanceTodayResponse> = {},
    access = false,
    history: readonly AttendanceHistoryRow[] = []
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
      clockOut: vi.fn(() => Promise.resolve())
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

  it('shows the missed clock-in warning when requested by the backend', async () => {
    const { fixture } = await setup({ shouldHaveClockedIn: true });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('You have not clocked in yet.');
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
});

function formatForTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  }).format(new Date(value));
}
