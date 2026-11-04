import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { WeeklyCompletionChartComponent } from './weekly-completion-chart.component';

const week = (weekStart: string, weekEnd: string, completedHours: number, completedTaskCount = 1): LedWeeklyCompletionWeek => ({
  weekStart, weekEnd, completedHours, completedTaskCount
});

function render(weeks: LedWeeklyCompletionWeek[], allocatedHours = 0, compact = false, percentLine = false): ComponentFixture<WeeklyCompletionChartComponent> {
  const fixture = TestBed.createComponent(WeeklyCompletionChartComponent);
  fixture.componentRef.setInput('weeks', weeks);
  fixture.componentRef.setInput('allocatedHours', allocatedHours);
  fixture.componentRef.setInput('compact', compact);
  fixture.componentRef.setInput('percentLine', percentLine);
  fixture.detectChanges();
  return fixture;
}

const bars = (fixture: ComponentFixture<WeeklyCompletionChartComponent>): HTMLElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('[data-testid="weekly-completion-bar"]'));

describe('WeeklyCompletionChartComponent', () => {
  const weeks = [week('2026-10-05', '2026-10-11', 20, 4), week('2026-10-12', '2026-10-18', 40, 8), week('2026-10-19', '2026-10-25', 10, 2)];

  it('draws one bar per week, scaled against the busiest week, with the current week last', () => {
    const fixture = render(weeks, 20200);
    const cols = bars(fixture);
    expect(cols.length).toBe(3);
    const heights = cols.map((c) => (c.querySelector('.wc-bar') as HTMLElement).style.height);
    expect(heights).toEqual(['50%', '100%', '25%']);
    expect(cols[0].querySelector('.wc-label')?.textContent?.trim()).toBe('5 Oct');
    expect(cols[2].querySelector('.wc-label')?.textContent?.trim()).toBe('This wk');
    expect(cols[2].querySelector('.wc-bar')?.classList).toContain('wc-bar--current');
  });

  it('labels each bar with its hours and explains the share of the allocation in the tooltip', () => {
    const fixture = render(weeks, 2000);
    const first = bars(fixture)[0];
    expect(first.querySelector('.wc-value')?.textContent?.trim()).toBe('20 h');
    expect(first.title).toBe('Week of 5 Oct: 20 h completed (4 tasks, 1% of the allocation)');
    expect(bars(fixture)[2].title).toContain('(so far)');
  });

  it('hides the hour labels when compact and has an accessible summary', () => {
    const fixture = render(weeks, 0, true);
    expect(fixture.nativeElement.querySelector('.wc-value')).toBeNull();
    const chart = fixture.nativeElement.querySelector('[data-testid="weekly-completion-chart"]') as HTMLElement;
    expect(chart.getAttribute('aria-label')).toBe('Completed task hours per week, last 3 weeks: 5 Oct 20 h, 12 Oct 40 h, This wk 10 h');
    expect(bars(fixture)[0].title).not.toContain('allocation');
  });

  it('says so when nothing was completed', () => {
    const fixture = render([week('2026-10-12', '2026-10-18', 0, 0), week('2026-10-19', '2026-10-25', 0, 0)]);
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-completion-empty"]')).not.toBeNull();
    expect((bars(fixture)[0].querySelector('.wc-bar') as HTMLElement).style.height).toBe('0%');
  });

  it('draws the completion % line: completed so far in these weeks as a share of the allocation, on a right axis', () => {
    const fixture = render(weeks, 100, false, true);
    const points = [...fixture.nativeElement.querySelectorAll('[data-testid="weekly-completion-point"]')] as SVGCircleElement[];
    // Cumulative 20, 60, 70 of 100 allocated hours.
    expect(points.map((p) => p.getAttribute('cy'))).toEqual(['80', '40', '30']);
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-completion-axis"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="img"]').getAttribute('aria-label')).toContain('70% of the allocation');
  });

  it('no % line without an allocation or when it is off', () => {
    expect(render(weeks, 0, false, true).nativeElement.querySelector('[data-testid="weekly-completion-line"]')).toBeNull();
    expect(render(weeks, 100, false, false).nativeElement.querySelector('[data-testid="weekly-completion-line"]')).toBeNull();
  });
});
