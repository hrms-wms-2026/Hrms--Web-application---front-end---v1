import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineResponse } from '../../models/activity-timeline.model';
import { TodayTotalTimeCardComponent } from './today-total-time-card.component';

// Fixed day: clocked in 09:00, out 17:00 (UTC), so nothing depends on the current time.
const CLOCK_IN = '2026-10-19T09:00:00Z';
const CLOCK_OUT = '2026-10-19T17:00:00Z';

function makeToday(overrides: Partial<AttendanceTodayResponse> = {}): AttendanceTodayResponse {
  return {
    attendanceStatus: 'clocked_out',
    clockInAt: CLOCK_IN,
    clockOutAt: CLOCK_OUT,
    totalWorkedMinutes: 320,
    requiredWorkMinutes: 480,
    breaks: [{ startedAt: '2026-10-19T12:00:00Z', endedAt: '2026-10-19T12:30:00Z' }],
    allowedClockInMethods: { web: true, desktopTray: true } as AttendanceTodayResponse['allowedClockInMethods'],
    ...overrides
  } as AttendanceTodayResponse;
}

describe('TodayTotalTimeCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    today: AttendanceTodayResponse | null,
    timeline: Observable<ActivityTimelineResponse> = of({ date: '2026-10-19', segments: [] }),
    loading = false
  ): Promise<{ fixture: ComponentFixture<TodayTotalTimeCardComponent>; loadToday: ReturnType<typeof vi.fn>; getMyTimeline: ReturnType<typeof vi.fn> }> {
    const loadToday = vi.fn();
    const getMyTimeline = vi.fn(() => timeline);
    await TestBed.configureTestingModule({
      imports: [TodayTotalTimeCardComponent],
      providers: [
        { provide: TimeTrackingStore, useValue: { today: signal(today), todayLoading: signal(loading), loadToday } },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TodayTotalTimeCardComponent);
    fixture.detectChanges();
    return { fixture, loadToday, getMyTimeline };
  }

  const q = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  const text = (fixture: ComponentFixture<unknown>, id: string): string => q(fixture, id)?.textContent?.trim() ?? '';

  it('loads today itself', async () => {
    const { loadToday } = await setup(null);
    expect(loadToday).toHaveBeenCalledOnce();
  });

  it('shows worked time against the required time as a ring', async () => {
    const { fixture } = await setup(makeToday());
    expect(text(fixture, 'today-total-time-value')).toBe('5h 20m');
    expect(text(fixture, 'today-total-time-target')).toBe('of 8h');
    expect(Number(q(fixture, 'today-total-time-ring')!.dataset['progress'])).toBeCloseTo(320 / 480);
  });

  it("splits clock-in to clock-out into working, focus, breaks and idle from today's activity", async () => {
    const timeline = of({
      date: '2026-10-19',
      segments: [
        { startedAt: '2026-10-19T09:00:00Z', endedAt: '2026-10-19T11:00:00Z', type: 'focus' as const },
        { startedAt: '2026-10-19T15:00:00Z', endedAt: '2026-10-19T15:20:00Z', type: 'idle' as const }
      ]
    });
    const { fixture, getMyTimeline } = await setup(makeToday(), timeline);
    expect(getMyTimeline).toHaveBeenCalledOnce();
    expect(text(fixture, 'today-total-time-row-focus')).toContain('2h');
    expect(text(fixture, 'today-total-time-row-break')).toContain('30m');
    expect(text(fixture, 'today-total-time-row-idle')).toContain('20m');
    // 8h - 2h focus - 30m break - 20m idle
    expect(text(fixture, 'today-total-time-row-working')).toContain('5h 10m');

    // Gauge: one segment per kind, in order; tracked (8h) equals required (8h), so no grey remainder.
    const segments: SVGPathElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="today-total-time-gauge-segment"]'));
    expect(segments.map((s) => s.getAttribute('data-segment'))).toEqual(['working', 'focus', 'break', 'idle']);
    expect(Number(segments[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(-(310 / 480) * 100);
  });

  it('fills the rest of the required time with a grey segment', async () => {
    const { fixture } = await setup(makeToday({ requiredWorkMinutes: 960 }));
    const segments: SVGPathElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="today-total-time-gauge-segment"]'));
    expect(segments.at(-1)!.getAttribute('data-segment')).toBe('remaining');
  });

  it('skips the activity timeline when the desktop tray is not a clock-in method, counting the rest as working', async () => {
    const { fixture, getMyTimeline } = await setup(makeToday({ allowedClockInMethods: { web: true, desktopTray: false } as AttendanceTodayResponse['allowedClockInMethods'] }));
    expect(getMyTimeline).not.toHaveBeenCalled();
    expect(text(fixture, 'today-total-time-row-working')).toContain('7h 30m');
    expect(text(fixture, 'today-total-time-row-focus')).toContain('0m');
  });

  it('never shows NaN: no clock-in, a failed timeline or no target all fall back cleanly', async () => {
    const { fixture } = await setup(
      makeToday({ clockInAt: null, clockOutAt: null, requiredWorkMinutes: null, breaks: undefined as unknown as [] }),
      throwError(() => new Error('boom'))
    );
    expect(fixture.nativeElement.textContent).not.toContain('NaN');
    expect(text(fixture, 'today-total-time-target')).toBe('no target today');
    expect(text(fixture, 'today-total-time-row-working')).toContain('0m');
  });

  it('shows a skeleton while loading and an empty state with no data', async () => {
    const loading = await setup(null, undefined, true);
    expect(q(loading.fixture, 'today-total-time-skeleton')).not.toBeNull();
    TestBed.resetTestingModule();
    const empty = await setup(null);
    expect(text(empty.fixture, 'today-total-time-empty')).toBe('No time recorded today.');
  });
});
