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

function render(input: WeekDayProgress[], inputs: Record<string, unknown> = {}): ComponentFixture<DailyWorkChartComponent> {
  const fixture = TestBed.createComponent(DailyWorkChartComponent);
  fixture.componentRef.setInput('days', input);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

const all = (f: ComponentFixture<DailyWorkChartComponent>, id: string): HTMLElement[] =>
  Array.from(f.nativeElement.querySelectorAll(`[data-testid="${id}"]`));
const headline = (f: ComponentFixture<DailyWorkChartComponent>) =>
  Array.from(
    (f.nativeElement as HTMLElement).querySelectorAll('[data-testid=bar-chart-headline] .bc-head-label, [data-testid=bar-chart-headline] .bc-head-row > span')
  ).map((n) => n.textContent?.trim());

describe('DailyWorkChartComponent (on the shared dashboard bar chart)', () => {
  const week = days((i) => (i < 5 ? { scheduledMinutes: 480, workedMinutes: 240 } : {}));

  it('draws Monday to Sunday with a scheduled bar beside a worked bar and the expected hours as a dash', () => {
    const f = render(week);
    expect(all(f, 'bar-chart-col').length).toBe(7);
    expect(all(f, 'bar-chart-label')[0].textContent).toContain('Mon');
    // 8h is the tallest figure: a round 0-5-10h axis.
    expect(all(f, 'bar-chart-axis')[0].textContent).toBe('10h5h0h');
    expect(all(f, 'bar-chart-stack')[0].style.height).toBe('80%');
    expect(all(f, 'bar-chart-pair')[0].style.height).toBe('40%');
    expect(all(f, 'bar-chart-col')[0].querySelector('[data-segment=scheduled]')).not.toBeNull();
    expect(all(f, 'bar-chart-marker').length).toBe(5);
    expect(all(f, 'bar-chart-marker')[0].style.bottom).toBe('80%');
    expect(all(f, 'bar-chart-legend')[0].textContent).toContain('Scheduled');
    expect(all(f, 'bar-chart-legend')[0].textContent).toContain('Expected');
  });

  it('without the planner shows only worked bars and no Scheduled key', () => {
    const f = render(week, { showScheduled: false });
    expect(all(f, 'bar-chart-pair').length).toBe(0);
    expect(all(f, 'bar-chart-col')[0].querySelector('[data-segment=worked]')).not.toBeNull();
    expect(all(f, 'bar-chart-col')[0].querySelector('[data-segment=scheduled]')).toBeNull();
    expect(all(f, 'bar-chart-legend')[0].textContent).not.toContain('Scheduled');
  });

  it('with a heading, reads the week then the hovered day against its schedule', () => {
    const f = render(week, { heading: 'Daily Work vs Schedule' });
    expect(headline(f)).toEqual(['Daily Work vs Schedule', '20h worked', 'of 40h expected']);
    all(f, 'bar-chart-col')[0].dispatchEvent(new Event('mouseenter'));
    f.detectChanges();
    expect(headline(f)).toEqual(['Mon 26 Oct', '4h worked', 'of 8h scheduled']);
  });

  it('copes with an empty week', () => {
    const f = render(days(() => ({ expectedMinutes: 0 })));
    expect(all(f, 'bar-chart-stack').length).toBe(0);
    expect(all(f, 'bar-chart-empty').length).toBe(1);
    expect(f.nativeElement.innerHTML).not.toContain('NaN');
  });

  it('compact hides the axis', () => {
    const f = render(week, { compact: true });
    expect(all(f, 'bar-chart-axis').length).toBe(0);
  });
});
