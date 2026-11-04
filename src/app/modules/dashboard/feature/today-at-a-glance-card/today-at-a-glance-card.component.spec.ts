import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { LeaveRequestApiService } from '../../../leave/data-access/leave-request-api.service';
import { LeaveRequestListItemResponse } from '../../../leave/models/leave-request.model';
import { TodayAtAGlanceCardComponent, isTickShown } from './today-at-a-glance-card.component';

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

interface StoreMock {
  today: ReturnType<typeof signal<AttendanceTodayResponse | null>>;
  todayLoading: ReturnType<typeof signal<boolean>>;
  todayError: ReturnType<typeof signal<string | null>>;
  todayLoadedAt: ReturnType<typeof signal<Date | null>>;
  loadToday: ReturnType<typeof vi.fn>;
}

function leave(startAt: string, endAt: string): LeaveRequestListItemResponse {
  return { startAt, endAt, status: 'approved' } as LeaveRequestListItemResponse;
}

describe('TodayAtAGlanceCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    overrides: Partial<AttendanceTodayResponse> | null = {},
    listMine: ReturnType<typeof vi.fn> = vi.fn(() => of([]))
  ): Promise<{
    fixture: ComponentFixture<TodayAtAGlanceCardComponent>;
    store: StoreMock;
    listMine: ReturnType<typeof vi.fn>;
  }> {
    const store: StoreMock = {
      today: signal(overrides === null ? null : { ...baseToday, ...overrides }),
      todayLoading: signal(false),
      todayError: signal(null),
      todayLoadedAt: signal<Date | null>(null),
      loadToday: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [TodayAtAGlanceCardComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: LeaveRequestApiService, useValue: { listMine } },
        { provide: AuthStore, useValue: { email: signal('arjun.kumar@onevo.dev') } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodayAtAGlanceCardComponent);
    fixture.detectChanges();
    return { fixture, store, listMine };
  }

  it('loads today on init', async () => {
    const { store } = await setup();
    expect(store.loadToday).toHaveBeenCalled();
  });

  it('the corner refresh button reloads today, spins while it runs, and sits outside the scaled canvas', async () => {
    const { fixture, store } = await setup();
    store.loadToday.mockClear();
    let finish!: () => void;
    store.loadToday.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="today-at-a-glance-canvas"] [data-testid="popout-refresh"]')).toBeNull();
    expect(el.querySelector('[data-testid="popout-expand"]')).toBeNull();
    expect(el.querySelector('[data-testid="refreshed-label"]')).toBeNull();
    const button = el.querySelector('[data-testid="today-refresh-corner"] [data-testid="popout-refresh"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(store.loadToday).toHaveBeenCalledTimes(1);
    expect(button.querySelector('svg')!.classList).toContain('animate-spin');

    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.querySelector('svg')!.classList).not.toContain('animate-spin');
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

  it('shows the active dot and working duration for a clocked-in "working" status, and a now marker on the shift bar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T08:00:00Z'));
    try {
      const { fixture } = await setup({ attendanceStatus: 'working', attendanceStatusLabel: 'Working', totalWorkedMinutes: 252 });
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-testid="status-active-dot"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="worked-duration"]')!.textContent!.trim()).toBe('4h 12m');
      expect(el.querySelector('[data-testid="today-activity-now"]')).not.toBeNull();
      expect(el.querySelectorAll('[data-testid="today-activity-ticks"] span').length).toBeGreaterThan(2);
      expect(el.querySelector('[data-testid="today-activity-legend"]')!.textContent).toContain('Upcoming');
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws a running break, even a 2-minute one, and turns the now marker grey', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T06:17:00Z'));
    try {
      const { fixture } = await setup({
        attendanceStatus: 'on_break',
        attendanceStatusLabel: 'On break',
        clockInAt: '2026-08-26T03:57:00Z',
        breaks: [{ startedAt: '2026-08-26T06:15:00Z', endedAt: null }]
      });
      const el: HTMLElement = fixture.nativeElement;
      const types = Array.from(el.querySelectorAll('[data-testid="today-activity-segment"]')).map((s) => s.getAttribute('data-segment-type'));
      expect(types).toEqual(['working', 'break']);
      expect(el.querySelector('[data-testid="today-activity-now-dot"]')!.getAttribute('data-state')).toBe('break');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the active dot once clocked out', async () => {
    const { fixture } = await setup({ attendanceStatus: 'clocked_out', clockOutAt: '2026-08-26T12:00:00Z' });
    expect(fixture.nativeElement.querySelector('[data-testid="status-active-dot"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="today-activity-now"]')).toBeNull();
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

  it('draws no worked blocks before the employee has clocked in', async () => {
    const { fixture } = await setup({ attendanceStatus: 'not_clocked_in', clockInAt: null, totalWorkedMinutes: 0 });
    expect(fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="today-activity-bar"]')).not.toBeNull();
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

  it('asks for approved leave around the work date and draws it as a Leave block', async () => {
    const listMine = vi.fn(() => of([leave('2026-08-26T05:00:00Z', '2026-08-26T06:00:00Z')]));
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z', clockOutAt: '2026-08-26T11:00:00Z', breaks: [] }, listMine);

    expect(listMine).toHaveBeenCalledWith({ status: 'approved', fromDate: '2026-08-25', toDate: '2026-08-27' });
    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working', 'leave', 'working']);
  });

  it('keeps a plain working block when leave cannot be loaded', async () => {
    const listMine = vi.fn(() => throwError(() => new Error('network error')));
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z', clockOutAt: '2026-08-26T11:00:00Z', breaks: [] }, listMine);

    const segments: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-testid="today-activity-segment"]');
    expect(Array.from(segments).map((s) => s.getAttribute('data-segment-type'))).toEqual(['working']);
  });

  it('shows the design legend: Working, Break, Leave, Upcoming', async () => {
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z' });
    const legend = (fixture.nativeElement.querySelector('[data-testid="today-activity-legend"]').textContent as string).replace(/\s+/g, ' ').trim();
    expect(legend).toBe('Working Break Leave Upcoming');
  });

  it('has no Today Plan button', async () => {
    const { fixture } = await setup({ clockInAt: '2026-08-26T03:00:00Z' });
    expect(fixture.nativeElement.textContent).not.toContain('Today Plan');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });
});

describe('isTickShown', () => {
  const shown = (count: number, max: number) => Array.from({ length: count }, (_, i) => i).filter((i) => isTickShown(i, count, max));

  it('labels every hour when they all fit', () => {
    expect(shown(10, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('labels every 2nd hour of a long 9 AM - 11 PM day, keeping the last and no crowding before it', () => {
    expect(shown(15, 10)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  });

  it('never puts a label one hour before the last when stepping by more than one', () => {
    expect(shown(16, 10)).toEqual([0, 2, 4, 6, 8, 10, 12, 15]);
  });

  it('shows just first and last on a narrow card', () => {
    expect(shown(15, 2)).toEqual([0, 14]);
  });
});
