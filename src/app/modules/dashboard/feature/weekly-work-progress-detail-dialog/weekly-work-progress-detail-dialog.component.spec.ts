import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyWorkProgressApiService } from '../../data-access/weekly-work-progress-api.service';
import { WeekDayProgress, WeekProgress, WeeklyWorkProgressResponse } from '../../models/weekly-work-progress.model';
import { WeeklyWorkProgressDetailDialogComponent } from './weekly-work-progress-detail-dialog.component';

const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

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

function payload(patch: Partial<WeeklyWorkProgressResponse> = {}): WeeklyWorkProgressResponse {
  return {
    weekStart: DATES[0], weekEnd: DATES[6], today: DATES[3], timezone: 'Asia/Colombo', plannerEnabled: true,
    thisWeek: week(), lastWeek: week({ progressPercent: 56, workedMinutes: 1320 }),
    tasks: { completedHours: 24, inProgressHours: 10, notStartedHours: 6, unestimatedCount: 0 }, ...patch
  };
}

describe('WeeklyWorkProgressDetailDialogComponent', () => {
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(() => of(payload({ weekStart: '2026-10-19', weekEnd: '2026-10-25' }))) };
  });

  afterEach(() => TestBed.resetTestingModule());

  function render(data = payload()): ComponentFixture<WeeklyWorkProgressDetailDialogComponent> {
    TestBed.configureTestingModule({
      imports: [WeeklyWorkProgressDetailDialogComponent],
      providers: [{ provide: WeeklyWorkProgressApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(WeeklyWorkProgressDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('initial', data);
    fixture.detectChanges();
    return fixture;
  }

  const q = (f: ComponentFixture<WeeklyWorkProgressDetailDialogComponent>, id: string): HTMLElement | null =>
    document.querySelector(`[data-testid="${id}"]`) ?? f.nativeElement.querySelector(`[data-testid="${id}"]`);
  const text = (f: ComponentFixture<WeeklyWorkProgressDetailDialogComponent>, id: string) =>
    (q(f, id)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('names the week in the header', () => {
    const f = render();
    expect(text(f, 'wwp-range')).toBe('Oct 26 – Nov 1, 2026');
  });

  it('shows the four KPI tiles with their shares of Expected', () => {
    const f = render();
    const tiles = text(f, 'wwp-kpis');
    expect(tiles).toContain('Expected');
    expect(tiles).toContain('Scheduled');
    expect(tiles).toContain('(80%)');
    expect(tiles).toContain('Remaining');
  });

  it('centres the schedule adherence donut on coverage', () => {
    const f = render();
    expect(text(f, 'wwp-adherence')).toContain('80%');
    expect(text(f, 'wwp-adherence')).toContain('Not Worked');
  });

  it('compares worked hours and completion with last week', () => {
    const f = render();
    expect(text(f, 'wwp-last-week')).toContain('+23%');
    expect(text(f, 'wwp-last-week')).toContain('+12%');
    expect(text(f, 'wwp-last-week')).toContain('vs last week (22h)');
  });

  it('weighs tasks by status with hours, shares and the total in the centre', () => {
    const f = render();
    expect(text(f, 'wwp-tasks')).toContain('Completed 24h (60%)');
    expect(text(f, 'wwp-tasks')).toContain('40h Total');
  });

  it('lists at most four insights', () => {
    const f = render();
    const items = (q(f, 'wwp-insights')?.querySelectorAll('li') ?? []).length;
    expect(items).toBeGreaterThan(0);
    expect(items).toBeLessThanOrEqual(4);
    expect(text(f, 'wwp-insights')).toContain('Schedule coverage is 80%.');
  });

  it('loads last week by its Monday', () => {
    const f = render();
    f.componentInstance.onWeekSelect('last');
    f.detectChanges();

    expect(api.get).toHaveBeenCalledWith('2026-10-19');
    expect(text(f, 'wwp-range')).toBe('Oct 19 – Oct 25, 2026');
  });

  it('hides scheduled figures and adherence without the planner', () => {
    const f = render(payload({ plannerEnabled: false }));
    expect(text(f, 'wwp-kpis')).not.toContain('Scheduled');
    expect(q(f, 'wwp-adherence')).toBeNull();
  });

  it('emits closed from the close button', () => {
    const f = render();
    const closed = vi.fn();
    f.componentInstance.closed.subscribe(closed);
    (q(f, 'wwp-close') as HTMLButtonElement).click();
    expect(closed).toHaveBeenCalled();
  });
});
