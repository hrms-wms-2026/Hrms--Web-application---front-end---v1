import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineResponse } from '../../models/activity-timeline.model';
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
  breaks: [],
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

const emptyActivityResponse: ActivityTimelineResponse = { date: '2026-08-26', segments: [] };

describe('TodayAtAGlanceCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    overrides: Partial<AttendanceTodayResponse> | null = {},
    getMyTimeline: ReturnType<typeof vi.fn> = vi.fn(() => of(emptyActivityResponse))
  ): Promise<{
    fixture: ComponentFixture<TodayAtAGlanceCardComponent>;
    store: StoreMock;
    getMyTimeline: ReturnType<typeof vi.fn>;
  }> {
    const store: StoreMock = {
      today: signal(overrides === null ? null : { ...baseToday, ...overrides }),
      todayLoading: signal(false),
      todayError: signal(null),
      loadToday: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [TodayAtAGlanceCardComponent],
      providers: [
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodayAtAGlanceCardComponent);
    fixture.detectChanges();
    return { fixture, store, getMyTimeline };
  }

  function tray(overrides: Partial<AttendanceTodayResponse> = {}): Partial<AttendanceTodayResponse> {
    return {
      clockInAt: '2026-08-26T03:00:00Z',
      clockOutAt: '2026-08-26T11:00:00Z',
      breaks: [],
      allowedClockInMethods: { ...baseToday.allowedClockInMethods, desktopTray: true },
      ...overrides
    };
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

  it('prefers the backend-provided status label over the local status map', async () => {
    const { fixture } = await setup({
      attendanceStatus: 'non_working_day',
      attendanceStatusLabel: 'Non-working day',
      clockInAt: null,
      totalWorkedMinutes: 0
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Non-working day');
    expect(text).not.toContain('Not specified');
  });

  it('falls back to "Not specified" for an unmapped status with no backend label', async () => {
    const { fixture } = await setup({
      attendanceStatus: 'some_future_status',
      attendanceStatusLabel: null,
      clockInAt: null,
      totalWorkedMinutes: 0
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Not specified');
  });

  it('does not show worked time or status while today is not yet loaded', async () => {
    const { fixture } = await setup(null);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Worked time');
    expect(text).not.toContain('Clocked in');
    expect(text).not.toContain('Not clocked in');
  });

  it('does not show the activity timeline before the employee has clocked in', async () => {
    const { fixture } = await setup({ attendanceStatus: 'not_clocked_in', clockInAt: null, totalWorkedMinutes: 0 });
    expect(fixture.nativeElement.querySelector('[data-testid="today-activity-timeline"]')).toBeNull();
  });

  it('renders a single working segment when there are no breaks', async () => {
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z', clockOutAt: '2026-08-26T11:00:00Z', breaks: [] });
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(segments.length).toBe(1);
    expect(segments[0].getAttribute('data-segment-type')).toBe('working');
  });

  it('splits the timeline into working/break/working segments around a closed break', async () => {
    const { fixture } = await setup({
      clockInAt: '2026-08-26T03:00:00Z',
      clockOutAt: '2026-08-26T11:00:00Z',
      breaks: [{ startedAt: '2026-08-26T07:00:00Z', endedAt: '2026-08-26T07:30:00Z' }]
    });
    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working', 'break', 'working']);
    expect(segments[1].style.width).toBe('6.25%');
  });

  it('treats an open (ongoing) break as running to the end of the visible timeline', async () => {
    const { fixture } = await setup({
      clockInAt: '2026-08-26T03:00:00Z',
      clockOutAt: '2026-08-26T11:00:00Z',
      breaks: [{ startedAt: '2026-08-26T10:00:00Z', endedAt: null }]
    });
    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working', 'break']);
  });

  it('does not request the activity timeline when the employee is not tray-eligible', async () => {
    const { getMyTimeline } = await setup({ clockInAt: '2026-08-26T03:00:00Z', clockOutAt: '2026-08-26T11:00:00Z' });
    expect(getMyTimeline).not.toHaveBeenCalled();
  });

  it('requests and merges focus/idle segments for a tray-eligible employee', async () => {
    const getMyTimeline = vi.fn(() =>
      of({
        date: '2026-08-26',
        segments: [{ startedAt: '2026-08-26T05:00:00Z', endedAt: '2026-08-26T06:00:00Z', type: 'focus' as const }]
      })
    );
    const { fixture } = await setup(tray(), getMyTimeline);

    expect(getMyTimeline).toHaveBeenCalledOnce();
    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working', 'focus', 'working']);
  });

  it('falls back to a plain working segment when the tray-eligible employee has no activity data yet', async () => {
    const { fixture } = await setup(tray());

    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working']);
  });

  it('falls back to a plain working segment when the activity request fails', async () => {
    const getMyTimeline = vi.fn(() => throwError(() => new Error('network error')));
    const { fixture } = await setup(tray(), getMyTimeline);

    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working']);
  });

  it('renders idle segments distinctly from focus segments', async () => {
    const getMyTimeline = vi.fn(() =>
      of({
        date: '2026-08-26',
        segments: [
          { startedAt: '2026-08-26T05:00:00Z', endedAt: '2026-08-26T05:20:00Z', type: 'idle' as const },
          { startedAt: '2026-08-26T05:20:00Z', endedAt: '2026-08-26T06:00:00Z', type: 'focus' as const }
        ]
      })
    );
    const { fixture } = await setup(tray(), getMyTimeline);

    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working', 'idle', 'focus', 'working']);
  });
});
