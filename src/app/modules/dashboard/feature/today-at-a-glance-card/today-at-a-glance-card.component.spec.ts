import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AuthStore } from '../../../../core/auth/state/auth.store';
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
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline } },
        { provide: AuthStore, useValue: { email: signal('arjun.kumar@onevo.dev') } }
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

  it('shows clocked-in status and the time left to finish the required day', async () => {
    const { fixture } = await setup({ attendanceStatus: 'clocked_in', requiredWorkMinutes: 480, totalWorkedMinutes: 320 });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Clocked in');
    expect(text).toContain('Time left to finish');
    expect(fixture.nativeElement.querySelector('[data-testid="time-left"]').textContent.trim()).toBe('2h 40m');
  });

  it('shows when work started, whatever the status label, and when it should finish', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T08:00:00Z'));
    try {
      const { fixture } = await setup({ attendanceStatus: 'working', attendanceStatusLabel: 'Working', requiredWorkMinutes: 480, totalWorkedMinutes: 320 });
      await fixture.whenStable();
      fixture.detectChanges();
      const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      expect(fixture.nativeElement.querySelector('[data-testid="started-at"]').textContent.trim()).toBe(`Started at ${clock('2026-08-26T03:24:00Z')}`);
      expect(fixture.nativeElement.textContent).not.toContain('Shift not active');
      // 160 minutes left from the 08:00Z refresh.
      expect(fixture.nativeElement.querySelector('[data-testid="finish-at"]').textContent.trim()).toBe(`Finish at ${clock('2026-08-26T10:40:00Z')}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the clock-out time once the day is finished, and "Shift not active" before clock-in', async () => {
    const out = await setup({ attendanceStatus: 'clocked_out', clockOutAt: '2026-08-26T12:00:00Z' });
    const clock = new Date('2026-08-26T12:00:00Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    expect(out.fixture.nativeElement.querySelector('[data-testid="finish-at"]').textContent.trim()).toBe(`Finished at ${clock}`);
    TestBed.resetTestingModule();
    const before = await setup({ attendanceStatus: 'not_clocked_in', clockInAt: null, totalWorkedMinutes: 0 });
    expect(before.fixture.nativeElement.textContent).toContain('Shift not active');
    expect(before.fixture.nativeElement.querySelector('[data-testid="finish-at"]')).toBeNull();
  });

  it('shows 0m left once the required time is worked, and a dash without a target', async () => {
    const done = await setup({ requiredWorkMinutes: 480, totalWorkedMinutes: 500 });
    expect(done.fixture.nativeElement.querySelector('[data-testid="time-left"]').textContent.trim()).toBe('0m');
    TestBed.resetTestingModule();
    const noTarget = await setup({ requiredWorkMinutes: 0, totalWorkedMinutes: 100 });
    expect(noTarget.fixture.nativeElement.querySelector('[data-testid="time-left"]').textContent.trim()).toBe('—');
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
    expect(text).not.toContain('Time left to finish');
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

  it('does not crash when the backend omits `breaks` entirely (seen live for an in-progress break)', async () => {
    const { fixture } = await setup({
      clockInAt: '2026-08-26T03:00:00Z',
      clockOutAt: null,
      breaks: undefined as unknown as []
    });
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(segments.length).toBeGreaterThan(0);
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

  it('colors idle segments with the border token, not the accent token - matching the Activity Timeline page', async () => {
    const getMyTimeline = vi.fn(() =>
      of({
        date: '2026-08-26',
        segments: [{ startedAt: '2026-08-26T05:00:00Z', endedAt: '2026-08-26T05:20:00Z', type: 'idle' as const }]
      })
    );
    const { fixture } = await setup(tray(), getMyTimeline);

    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    const idle = Array.from(segments).find((s) => s.getAttribute('data-segment-type') === 'idle')!;
    expect(idle.style.backgroundColor).toBe('var(--color-border)');
    expect(idle.style.opacity).toBe('0.4');
  });

  it('links to the full Activity Timeline page', async () => {
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z', clockOutAt: '2026-08-26T11:00:00Z' });
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="today-at-a-glance-view-timeline-link"]');
    expect(link.getAttribute('href')).toBe('/dashboard/activity-timeline');
  });
});
