import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { WeekDayProgress } from '../../models/weekly-work-progress.model';
import { DailyWorkChartComponent } from './daily-work-chart.component';

const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

function days(patch: (i: number) => Partial<WeekDayProgress> = () => ({})): WeekDayProgress[] {
  return DATES.map((date, i) => ({
    date, isExpected: i < 5, isHoliday: false, leaveMinutes: 0, expectedMinutes: i < 5 ? 480 : 0,
    scheduledMinutes: 0, workedMinutes: 0, attendanceMinutes: 0, ...patch(i)
  }));
}

function render(input: WeekDayProgress[], showScheduled = true, compact = false): ComponentFixture<DailyWorkChartComponent> {
  const fixture = TestBed.createComponent(DailyWorkChartComponent);
  fixture.componentRef.setInput('days', input);
  fixture.componentRef.setInput('showScheduled', showScheduled);
  fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  return fixture;
}

const all = (f: ComponentFixture<DailyWorkChartComponent>, id: string): HTMLElement[] =>
  Array.from(f.nativeElement.querySelectorAll(`[data-testid="${id}"]`));

describe('DailyWorkChartComponent', () => {
  it('draws Monday to Sunday with scheduled and worked bars scaled to an even-hour axis', () => {
    const f = render(days((i) => (i === 0 ? { scheduledMinutes: 480, workedMinutes: 240 } : {})));

    expect(all(f, 'daily-work-day').length).toBe(7);
    expect(all(f, 'daily-work-scheduled')[0].style.height).toBe('100%');
    expect(all(f, 'daily-work-worked')[0].style.height).toBe('50%');
    expect(all(f, 'daily-work-day')[0].textContent).toContain('Mon');
    expect(all(f, 'daily-work-day')[0].textContent).toContain('8h / 4h');
    expect(all(f, 'daily-work-axis')[0].textContent).toContain('8h');
  });

  it('without the planner shows worked against expected and no scheduled bars', () => {
    const f = render(days((i) => (i === 0 ? { scheduledMinutes: 480, workedMinutes: 240 } : {})), false);

    expect(all(f, 'daily-work-scheduled').length).toBe(0);
    expect(all(f, 'daily-work-day')[0].textContent).toContain('4h / 8h');
    expect(f.nativeElement.textContent).not.toContain('Scheduled');
  });

  it('draws the expected line through all seven days', () => {
    const f = render(days());
    const points = all(f, 'daily-work-expected-line')[0].getAttribute('points') ?? '';

    expect(points.trim().split(' ').length).toBe(7);
    expect(points).not.toContain('NaN');
  });

  it('copes with an empty week', () => {
    const f = render(days(() => ({ expectedMinutes: 0 })));

    expect(all(f, 'daily-work-worked').every((b) => b.style.height === '0%')).toBe(true);
    expect(f.nativeElement.innerHTML).not.toContain('NaN');
  });

  it('compact hides the axis and the hours line', () => {
    const f = render(days((i) => (i === 0 ? { workedMinutes: 240 } : {})), true, true);

    expect(all(f, 'daily-work-axis').length).toBe(0);
    expect(all(f, 'daily-work-day')[0].textContent).not.toContain('/');
  });
});
