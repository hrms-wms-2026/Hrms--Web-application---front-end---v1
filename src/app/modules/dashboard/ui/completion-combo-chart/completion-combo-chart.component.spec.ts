import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { CompletionComboChartComponent } from './completion-combo-chart.component';

const bucket = (weekStart: string, weekEnd: string, completedHours: number, completedTaskCount = 1): LedWeeklyCompletionWeek => ({
  weekStart, weekEnd, completedHours, completedTaskCount
});

interface Options {
  allocatedHours?: number;
  granularity?: 'week' | 'day';
  rangeLabel?: string;
  today?: string;
}

function render(buckets: LedWeeklyCompletionWeek[], options: Options = {}): ComponentFixture<CompletionComboChartComponent> {
  const fixture = TestBed.createComponent(CompletionComboChartComponent);
  fixture.componentRef.setInput('buckets', buckets);
  fixture.componentRef.setInput('allocatedHours', options.allocatedHours ?? 0);
  fixture.componentRef.setInput('granularity', options.granularity ?? 'week');
  fixture.componentRef.setInput('rangeLabel', options.rangeLabel ?? '');
  fixture.componentRef.setInput('today', options.today ?? '2026-10-21');
  fixture.detectChanges();
  return fixture;
}

const q = (fixture: ComponentFixture<CompletionComboChartComponent>, id: string): HTMLElement | null =>
  fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
const all = (fixture: ComponentFixture<CompletionComboChartComponent>, id: string): HTMLElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`));
const text = (el: HTMLElement | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('CompletionComboChartComponent', () => {
  const weeks = [bucket('2026-10-05', '2026-10-11', 20, 4), bucket('2026-10-12', '2026-10-18', 40, 8), bucket('2026-10-19', '2026-10-25', 10, 2)];

  it('draws a bar per week on a rounded-up left axis, current week last and striped', () => {
    const fixture = render(weeks, { allocatedHours: 200, rangeLabel: 'Last 3 weeks' });
    const cols = all(fixture, 'cc-bar');
    expect(cols.length).toBe(3);
    // Busiest week 40 h -> axis 0 / 20 / 40 / 60 (three nice steps).
    const heights = cols.map((c) => Math.round(parseFloat((c.querySelector('.cc-bar') as HTMLElement).style.height)));
    expect(heights).toEqual([33, 67, 17]);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.cc-axis--left span'), (e: Element) => e.textContent!.trim())).toEqual(['60', '40', '20', '0']);
    expect(cols[2].querySelector('.cc-bar--current')).not.toBeNull();
    expect(text(cols[0])).toBe('5 Oct');
    expect(text(cols[2])).toBe('This wk');
  });

  it('headline: the range total and completion; hovering a week swaps to that week', () => {
    const fixture = render(weeks, { allocatedHours: 200, rangeLabel: 'Last 3 weeks' });
    expect(text(q(fixture, 'cc-caption'))).toBe('Completed · Last 3 weeks');
    expect(text(q(fixture, 'cc-value'))).toBe('70 h');
    expect(text(q(fixture, 'cc-pill'))).toBe('35% done');
    expect(text(q(fixture, 'cc-total'))).toBe('70 h');
    expect(text(q(fixture, 'cc-completion'))).toBe('35%');

    all(fixture, 'cc-bar')[1].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(text(q(fixture, 'cc-caption'))).toBe('12 Oct – 18 Oct');
    expect(text(q(fixture, 'cc-value'))).toBe('40 h');
    expect(text(q(fixture, 'cc-pill'))).toBe('30% done');
    expect(q(fixture, 'cc-plot')!.classList).toContain('cc-plot--hover');

    all(fixture, 'cc-bar')[1].dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(text(q(fixture, 'cc-value'))).toBe('70 h');
  });

  it('draws the cumulative completion line on its own axis; none without an allocation', () => {
    const withLine = render(weeks, { allocatedHours: 200 });
    expect(q(withLine, 'cc-line')).not.toBeNull();
    expect(all(withLine, 'cc-dot').length).toBe(3);

    const noLine = render(weeks);
    expect(q(noLine, 'cc-line')).toBeNull();
    expect(q(noLine, 'cc-pill')).toBeNull();
    expect(text(q(noLine, 'cc-completion'))).toBe('—');
  });

  it('days: weekday labels, Today for the current day, later days have no bar and no dot', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) =>
      bucket(d, d, i < 3 ? 4 : 0)
    );
    const fixture = render(days, { allocatedHours: 100, granularity: 'day', rangeLabel: 'This week' });
    const cols = all(fixture, 'cc-bar');
    expect(cols.map(text)).toEqual(['Mon', 'Tue', 'Today', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(cols[3].querySelector('.cc-bar--future')).not.toBeNull();
    expect(all(fixture, 'cc-dot').length).toBe(3);
    expect(text(q(fixture, 'cc-completion'))).toBe('12%');
  });

  it('shows every other week label with many weeks, always the current one', () => {
    const many = Array.from({ length: 10 }, (_, i) => bucket(`2026-08-${String(17 + i).padStart(2, '0')}`, `2026-08-${String(17 + i).padStart(2, '0')}`, 1));
    const fixture = render(many, { today: '2026-08-26' });
    const labels = all(fixture, 'cc-bar').map(text);
    expect(labels.filter((l) => l !== '').length).toBe(5);
    expect(labels[9]).toBe('This wk');
  });

  it('says so when nothing was completed in the range', () => {
    const fixture = render([bucket('2026-10-19', '2026-10-25', 0, 0)]);
    expect(q(fixture, 'cc-empty')).not.toBeNull();
  });
});
