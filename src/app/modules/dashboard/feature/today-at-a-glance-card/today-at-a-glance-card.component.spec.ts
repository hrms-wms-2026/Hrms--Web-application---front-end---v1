import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { TodayAtAGlanceCardComponent } from './today-at-a-glance-card.component';

const baseToday: AttendanceTodayResponse = {
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  workDate: '2026-08-26',
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
  attendanceStatus: 'clocked_in',
  clockInAt: '2026-08-26T03:24:00Z',
  clockOutAt: null,
  totalWorkedMinutes: 320,
  attendanceSource: null,
  canClockIn: false,
  canClockOut: true,
  canStartBreak: true,
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

type StoreMock = {
  today: ReturnType<typeof signal<AttendanceTodayResponse | null>>;
  todayLoading: ReturnType<typeof signal<boolean>>;
  todayError: ReturnType<typeof signal<string | null>>;
  loadToday: ReturnType<typeof vi.fn>;
};

describe('TodayAtAGlanceCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(overrides: Partial<AttendanceTodayResponse> | null = {}): Promise<{
    fixture: ComponentFixture<TodayAtAGlanceCardComponent>;
    store: StoreMock;
  }> {
    const store: StoreMock = {
      today: signal(overrides === null ? null : { ...baseToday, ...overrides }),
      todayLoading: signal(false),
      todayError: signal(null),
      loadToday: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [TodayAtAGlanceCardComponent],
      providers: [{ provide: TimeTrackingStore, useValue: store }]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodayAtAGlanceCardComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('loads today on init', async () => {
    const { store } = await setup();
    expect(store.loadToday).toHaveBeenCalled();
  });

  it('shows clocked-in status and worked time', async () => {
    const { fixture } = await setup({ attendanceStatus: 'clocked_in', totalWorkedMinutes: 320 });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Clocked in');
    expect(text).toContain('5h 20m');
  });

  it('shows not-clocked-in status when the employee has not clocked in', async () => {
    const { fixture } = await setup({ attendanceStatus: 'not_clocked_in', clockInAt: null, totalWorkedMinutes: 0 });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Not clocked in');
  });

  it('does not show worked time or status while today is not yet loaded', async () => {
    const { fixture } = await setup(null);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Worked time');
    expect(text).not.toContain('Clocked in');
    expect(text).not.toContain('Not clocked in');
  });
});
