import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyWorkProgressApiService } from '../../data-access/weekly-work-progress-api.service';
import { WeekDayProgress, WeekProgress, WeeklyWorkProgressResponse } from '../../models/weekly-work-progress.model';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { WeeklyProgressCardComponent } from './weekly-progress-card.component';

const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
/** Card host sizes at 1440 px: columns about 97 px, rows 96 px with 12 px gaps. */
const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

function days(): WeekDayProgress[] {
  return DATES.map((date, i) => ({
    date, isExpected: i < 5, isHoliday: false, leaveMinutes: 0, expectedMinutes: i < 5 ? 480 : 0,
    scheduledMinutes: i < 4 ? 480 : 0, workedMinutes: i < 3 ? 540 : 0, attendanceMinutes: 0
  }));
}

function week(patch: Partial<WeekProgress> = {}): WeekProgress {
  return {
    expectedMinutes: 2400, expectedToDateMinutes: 1600, scheduledTaskMinutes: 1920, scheduledMeetingMinutes: 0, scheduledMinutes: 1920,
    loggedTaskMinutes: 1620, creditedMeetingMinutes: 0, workedMinutes: 1620, attendanceMinutes: 1700, remainingMinutes: 780,
    progressPercent: 68, planningCoveragePercent: 80, scheduleAdherencePercent: 84.4, status: 'on_track', days: days(), ...patch
  };
}

function payload(patch: Partial<WeeklyWorkProgressResponse> = {}, thisWeek: Partial<WeekProgress> = {}): WeeklyWorkProgressResponse {
  return {
    weekStart: DATES[0], weekEnd: DATES[6], today: DATES[3], timezone: 'Asia/Colombo', plannerEnabled: true,
    thisWeek: week(thisWeek), lastWeek: week({ progressPercent: 56, workedMinutes: 1320 }),
    tasks: { completedHours: 24, inProgressHours: 10, notStartedHours: 6, unestimatedCount: 0 }, ...patch
  };
}

describe('WeeklyProgressCardComponent', () => {
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    stubResizeObserver();
    api = { get: vi.fn(() => of(payload())) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function render(data: ReturnType<typeof fakeWidgetData>, width = 0, height = 0): ComponentFixture<WeeklyProgressCardComponent> {
    // Some tests render a second card at another size: start from a clean module and observer list.
    TestBed.resetTestingModule();
    FakeResizeObserver.instances = [];
    TestBed.configureTestingModule({
      imports: [WeeklyProgressCardComponent],
      providers: [{ provide: WeeklyWorkProgressApiService, useValue: api }, data.provider]
    });
    const fixture = TestBed.createComponent(WeeklyProgressCardComponent);
    fixture.detectChanges();
    if (width > 0) {
      FakeResizeObserver.instances[0].trigger(width, height);
      fixture.detectChanges();
    }
    return fixture;
  }

  const q = (f: ComponentFixture<WeeklyProgressCardComponent>, id: string): HTMLElement | null =>
    f.nativeElement.querySelector(`[data-testid="${id}"]`);
  const qa = (f: ComponentFixture<WeeklyProgressCardComponent>, id: string): HTMLElement[] =>
    Array.from(f.nativeElement.querySelectorAll(`[data-testid="${id}"]`));
  const text = (f: ComponentFixture<WeeklyProgressCardComponent>) => (f.nativeElement as HTMLElement).textContent ?? '';

  it('takes the bootstrap payload without calling the API', () => {
    const f = render(fakeWidgetData('success', payload()), cols(2), rows(2));

    expect(api.get).not.toHaveBeenCalled();
    expect(q(f, 'wp-percent')?.textContent).toContain('68%');
    expect(text(f)).toContain('Weekly Work Progress');
  });

  it('fetches the current week when the bootstrap has no data', () => {
    render(fakeWidgetData('client'), cols(2), rows(2));

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith();
  });

  it('refreshes through the dashboard every minute while visible', () => {
    vi.useFakeTimers();
    const data = fakeWidgetData('success', payload());
    render(data, cols(2), rows(2));

    vi.advanceTimersByTime(60_000);

    expect(data.refresh).toHaveBeenCalledTimes(1);
  });

  it('re-renders for a new size on its own, without a manual change detection', async () => {
    const f = render(fakeWidgetData('success', payload()), cols(2), rows(2));
    f.autoDetectChanges();

    FakeResizeObserver.instances[0].trigger(cols(6), rows(5));
    await f.whenStable();

    expect(q(f, 'daily-work-chart')).not.toBeNull();
  });

  it('2x2 shows the fixed-size donut with the percent and status only', () => {
    const f = render(fakeWidgetData('success', payload()), cols(2), rows(2));

    expect(q(f, 'wp-donut')?.style.width).toBe('140px');
    expect(q(f, 'wp-status')?.textContent).toContain('On Track');
    expect(q(f, 'wp-delta')).toBeNull();
    expect(q(f, 'wp-week-bars')).toBeNull();
  });

  it('a wide 2-row card shows the change and both weeks, then tiles from 640 px', () => {
    const f = render(fakeWidgetData('success', payload()), cols(5), rows(2));

    expect(q(f, 'wp-delta')?.textContent).toContain('+12%');
    expect(q(f, 'wp-delta')?.textContent).toContain('vs last week (56%)');
    expect(q(f, 'wp-week-bars')?.textContent).toContain('27h / 40h');
    expect(q(f, 'wp-mini-tiles')).toBeNull();

    const wide = render(fakeWidgetData('success', payload()), cols(7), rows(2));
    expect(q(wide, 'wp-mini-tiles')).not.toBeNull();
  });

  it('a narrow tall card stacks the tiles under the donut', () => {
    const f = render(fakeWidgetData('success', payload()), cols(2), rows(5));

    const tileText = (t: HTMLElement) =>
      Array.from(t.children).map((c) => c.textContent?.replace(/\s+/g, ' ').trim()).join(' ');
    expect(qa(f, 'wp-stacked-tile').map(tileText)).toEqual([
      'Expected 40h', 'Scheduled 32h (80%)', 'Worked 27h (68%)', 'Remaining 13h (33%)'
    ]);
    expect(q(f, 'wp-donut')?.style.width).toBe('140px');
  });

  it('a large card adds the daily chart, then the weekly comparison', () => {
    const f = render(fakeWidgetData('success', payload()), cols(6), rows(5));
    expect(q(f, 'daily-work-chart')).not.toBeNull();
    expect(q(f, 'wp-comparison')).toBeNull();
    expect(q(f, 'wp-donut')?.style.width).toBe('140px');

    const tall = render(fakeWidgetData('success', payload()), cols(6), rows(7));
    expect(q(tall, 'wp-comparison')?.textContent).toContain('vs last week (22h)');
  });

  it('shows zero hours as 0h and an unchanged week without an arrow up', () => {
    const data = payload({ lastWeek: week({ progressPercent: 0, workedMinutes: 0 }) }, { progressPercent: 0, workedMinutes: 0 });
    const f = render(fakeWidgetData('success', data), cols(7), rows(2));

    expect(q(f, 'wp-week-bars')?.textContent).toContain('0h / 40h');
    expect(q(f, 'wp-delta')?.textContent).toContain('→ 0%');
    expect(q(f, 'wp-delta')?.textContent).not.toContain('↗');
  });

  it('hides scheduled figures when the planner is off', () => {
    const f = render(fakeWidgetData('success', payload({ plannerEnabled: false })), cols(6), rows(5));

    expect(text(f)).not.toContain('Scheduled');
    expect(text(f)).toContain('Remaining');
  });

  it('says so when the legal entity has no working hours', () => {
    const f = render(fakeWidgetData('success', payload({}, { status: 'no_target', expectedMinutes: 0 })), cols(6), rows(5));

    expect(q(f, 'wp-no-target')?.textContent).toContain('No working hours set for your legal entity');
    expect(q(f, 'wp-donut')).toBeNull();
  });

  it('shows an error with retry when its own load fails', () => {
    api.get.mockReturnValue(throwError(() => new Error('boom')));
    const f = render(fakeWidgetData('client'), cols(6), rows(5));

    expect(text(f)).toContain("Couldn't load this week's progress.");
  });

  it('clicking the card body opens the detail popup', () => {
    const f = render(fakeWidgetData('success', payload()), cols(6), rows(5));
    expect(document.querySelector('[data-testid="wwp-range"]')).toBeNull();

    (f.nativeElement.querySelector('.wp-body') as HTMLElement).click();
    f.detectChanges();

    expect(document.querySelector('[data-testid="wwp-range"]')?.textContent).toContain('Oct 26');
  });

  it('switching to last week loads that week by its Monday', () => {
    const f = render(fakeWidgetData('success', payload()), cols(6), rows(5));
    api.get.mockReturnValue(of(payload({ weekStart: '2026-10-19' }, { progressPercent: 56 })));

    const select = q(f, 'wp-week-select') as HTMLSelectElement;
    select.value = 'last';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();

    expect(api.get).toHaveBeenCalledWith('2026-10-19');
    expect(q(f, 'wp-percent')?.textContent).toContain('56%');
  });
});
