import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TeamAttendanceTrendPoint } from '../../models/team-attendance.model';
import { AttendanceDayChartComponent } from './attendance-day-chart.component';

function point(date: string, present: number, late = 0, absent = 0, onLeave = 0): TeamAttendanceTrendPoint {
  const denominator = present + late + absent;
  return { date, present, late, absent, onLeave, pending: 0, rate: denominator ? Math.round(((present + late) * 1000) / denominator) / 10 : null };
}

function week(): TeamAttendanceTrendPoint[] {
  return ['26', '27', '28', '29', '30', '31'].map((d) => point(`2026-10-${d}`, 0)).concat(point('2026-11-01', 0));
}

function setup(points: TeamAttendanceTrendPoint[], inputs: Record<string, unknown> = {}): ComponentFixture<AttendanceDayChartComponent> {
  const fixture = TestBed.createComponent(AttendanceDayChartComponent);
  fixture.componentRef.setInput('points', points);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}
const render = (points: TeamAttendanceTrendPoint[], compact = false): HTMLElement =>
  setup(points, { compact }).nativeElement as HTMLElement;
const cols = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('[data-testid=bar-chart-col]')];

describe('AttendanceDayChartComponent (on the shared dashboard bar chart)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws one bar per day with weekday labels for a week', () => {
    const el = render(week());

    expect(cols(el).length).toBe(7);
    expect(el.querySelector('[data-testid=bar-chart-label]')?.textContent?.trim()).toBe('Mon');
  });

  it('draws one bar per day with day numbers for a month', () => {
    const points = Array.from({ length: 31 }, (_, i) => point(`2026-10-${String(i + 1).padStart(2, '0')}`, 1));
    const el = render(points);

    expect(cols(el).length).toBe(31);
    expect(el.querySelector('[data-testid=bar-chart-label]')?.textContent?.trim()).toBe('1');
  });

  it('shows every 5th day label when compact in a month', () => {
    const points = Array.from({ length: 30 }, (_, i) => point(`2026-09-${String(i + 1).padStart(2, '0')}`, 1));
    const labels = [...render(points, true).querySelectorAll('[data-testid=bar-chart-label]')].map((l) => l.textContent?.trim());

    expect(labels.filter((l) => l).length).toBe(7); // 1, 5, 10, 15, 20, 25, 30
  });

  it('stacks present, late, absent and leave in each day, the bars against a round axis', () => {
    const points = week();
    points[0] = point('2026-10-26', 6, 2, 2);
    points[1] = point('2026-10-27', 3, 0, 2);
    const el = render(points);
    const bars = cols(el);
    const stack = (bar: HTMLElement) => bar.querySelector<HTMLElement>('[data-testid=bar-chart-stack]');
    const seg = (bar: HTMLElement, kind: string) => bar.querySelector<HTMLElement>(`[data-segment=${kind}]`)?.style.height;

    // The busiest day (10) tops a 0-5-10 axis; the next day (5) is half as tall.
    expect([...el.querySelectorAll('[data-testid=bar-chart-axis] > span')].map((s) => s.textContent?.trim())).toEqual(['10', '5', '0']);
    expect(stack(bars[0])?.style.height).toBe('100%');
    expect(stack(bars[1])?.style.height).toBe('50%');
    expect(seg(bars[0], 'present')).toBe('60%');
    expect(seg(bars[0], 'late')).toBe('20%');
    expect(seg(bars[0], 'absent')).toBe('20%');
    expect(seg(bars[1], 'present')).toBe('60%');
    expect(stack(bars[2])).toBeNull();
  });

  it('labels the chart for screen readers', () => {
    const points = week();
    points[0] = point('2026-10-26', 9, 0, 1);
    const chart = render(points).querySelector('[role=img]');

    expect(chart?.getAttribute('aria-label')).toContain('Mon 26 Oct: 90%');
  });

  it('with a heading, reads the period rate until a day is hovered, then that day', () => {
    const points = week();
    points[0] = point('2026-10-26', 9, 0, 1);
    const fixture = setup(points, { heading: 'Trend', rate: '95%', chip: { text: '↑ 4 pp', tone: 'up' } });
    const el = fixture.nativeElement as HTMLElement;
    const headline = () =>
      [...el.querySelectorAll('[data-testid=bar-chart-headline] .bc-head-label, [data-testid=bar-chart-headline] .bc-head-row > span')]
        .map((n) => n.textContent?.trim())
        .join(' | ');

    expect(headline()).toBe('Trend | 95% | ↑ 4 pp');
    cols(el)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(headline()).toBe('Mon 26 Oct | 90% | 9 of 10 in');
    el.querySelector('[data-testid=bar-chart]')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(headline()).toBe('Trend | 95% | ↑ 4 pp');
  });

  it('has no headline without a heading', () => {
    expect(render(week()).querySelector('[data-testid=bar-chart-headline]')).toBeNull();
  });
});
