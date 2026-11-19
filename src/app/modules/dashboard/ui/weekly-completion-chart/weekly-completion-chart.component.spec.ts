import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { WeeklyCompletionChartComponent } from './weekly-completion-chart.component';

const week = (weekStart: string, weekEnd: string, completedHours: number, completedTaskCount = 1): LedWeeklyCompletionWeek => ({
  weekStart, weekEnd, completedHours, completedTaskCount
});

function render(weeks: LedWeeklyCompletionWeek[], allocatedHours = 0): ComponentFixture<WeeklyCompletionChartComponent> {
  const fixture = TestBed.createComponent(WeeklyCompletionChartComponent);
  fixture.componentRef.setInput('weeks', weeks);
  fixture.componentRef.setInput('allocatedHours', allocatedHours);
  fixture.detectChanges();
  return fixture;
}

const bars = (fixture: ComponentFixture<WeeklyCompletionChartComponent>): HTMLElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('[data-testid="bar-chart-col"]'));
const text = (fixture: ComponentFixture<WeeklyCompletionChartComponent>, id: string): string =>
  (fixture.nativeElement.querySelector(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
const ticks = (fixture: ComponentFixture<WeeklyCompletionChartComponent>): string[] =>
  Array.from(fixture.nativeElement.querySelectorAll('[data-testid="bar-chart-axis"] > span'), (el: Element) => el.textContent?.trim() ?? '');

describe('WeeklyCompletionChartComponent', () => {
  const weeks = [week('2026-10-05', '2026-10-11', 20, 4), week('2026-10-12', '2026-10-18', 40, 8), week('2026-10-19', '2026-10-25', 10, 2)];

  it('fills one pill track per week against a round axis, with the current week last', () => {
    const fixture = render(weeks, 20200);
    const cols = bars(fixture);
    expect(cols.length).toBe(3);
    // Busiest week 40 h: axis steps of 20 h, so the axis tops out at 40 h.
    expect(cols.map((c) => (c.querySelector('[data-testid="bar-chart-stack"]') as HTMLElement).style.height)).toEqual(['50%', '100%', '25%']);
    expect(ticks(fixture)).toEqual(['40', '20', '0']);
    expect(cols[0].querySelector('.bc-label')?.textContent?.trim()).toBe('5 Oct');
    expect(cols[2].querySelector('.bc-label')?.textContent?.trim()).toBe('This wk');
    expect(cols[2].querySelector('[data-testid="bar-chart-stack"]')?.classList).toContain('bc-stack--current');
  });

  it('rounds the axis up and writes thousands as K', () => {
    const fixture = render([week('2026-10-12', '2026-10-18', 412), week('2026-10-19', '2026-10-25', 66.5)]);
    expect(ticks(fixture)).toEqual(['1K', '500', '0']);
    expect(parseFloat((bars(fixture)[0].querySelector('[data-testid="bar-chart-stack"]') as HTMLElement).style.height)).toBeCloseTo(41.2, 5);
  });

  it('headline: the total with the last full week against the week before', () => {
    const fixture = render(weeks);
    expect(text(fixture, 'bar-chart-headline')).toContain('Weekly completion · last 3 weeks');
    expect(text(fixture, 'bar-chart-value')).toBe('70 h');
    const chip = fixture.nativeElement.querySelector('[data-testid="bar-chart-chip"]') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('+100%');
    expect(chip.classList).toContain('bc-chip--up');
  });

  it('headline reads the hovered week, then the total again on leaving the chart', () => {
    const fixture = render(weeks);
    bars(fixture)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(bars(fixture)[0].classList).toContain('bc-col--active');
    expect(text(fixture, 'bar-chart-headline')).toContain('Week of 5 Oct');
    expect(text(fixture, 'bar-chart-value')).toBe('20 h');
    expect(text(fixture, 'bar-chart-chip')).toBe('4 tasks');

    bars(fixture)[2].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(text(fixture, 'bar-chart-headline')).toContain('Week of 19 Oct (so far)');

    fixture.nativeElement.querySelector('[data-testid="bar-chart"]').dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(text(fixture, 'bar-chart-value')).toBe('70 h');
  });

  it('explains each week, and its share of the allocation, in the tooltip and the accessible summary', () => {
    const fixture = render(weeks, 2000);
    expect(bars(fixture)[0].title).toBe('Week of 5 Oct: 20 h completed (4 tasks, 1% of the allocation)');
    expect(render(weeks).nativeElement.querySelector('[data-testid="bar-chart-col"]').title).not.toContain('allocation');
    const chart = fixture.nativeElement.querySelector('[data-testid="bar-chart"]') as HTMLElement;
    expect(chart.getAttribute('aria-label')).toBe('Completed task hours per week, last 3 weeks: 5 Oct 20 h, 12 Oct 40 h, This wk 10 h');
  });

  it('day buckets: weekday labels, Today, and empty tracks for the days still to come', () => {
    const fixture = TestBed.createComponent(WeeklyCompletionChartComponent);
    fixture.componentRef.setInput('weeks', [
      week('2026-10-19', '2026-10-19', 8, 2),
      week('2026-10-20', '2026-10-20', 4, 1),
      week('2026-10-21', '2026-10-21', 0, 0)
    ]);
    fixture.componentRef.setInput('granularity', 'day');
    fixture.componentRef.setInput('rangeLabel', 'This week');
    fixture.componentRef.setInput('today', '2026-10-20');
    fixture.detectChanges();
    const cols = bars(fixture);
    expect(cols.map((c) => c.querySelector('.bc-label')?.textContent?.trim())).toEqual(['Mon', 'Today', 'Wed']);
    expect(cols[2].querySelector('[data-testid="bar-chart-stack"]')).toBeNull();
    expect(text(fixture, 'bar-chart-headline')).toContain('Completed · This week');
    expect(text(fixture, 'bar-chart-value')).toBe('12 h');
    expect(fixture.nativeElement.querySelector('[data-testid="bar-chart-chip"]')).toBeNull();

    cols[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(text(fixture, 'bar-chart-headline')).toContain('Mon 19 Oct');
    expect(text(fixture, 'bar-chart-value')).toBe('8 h');
  });

  it('has no completion % line', () => {
    const fixture = render(weeks, 100);
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('says so when nothing was completed, with empty tracks and no change chip', () => {
    const fixture = render([week('2026-10-05', '2026-10-11', 0, 0), week('2026-10-12', '2026-10-18', 0, 0), week('2026-10-19', '2026-10-25', 0, 0)]);
    expect(fixture.nativeElement.querySelector('[data-testid="bar-chart-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="bar-chart-stack"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="bar-chart-chip"]')).toBeNull();
  });
});
