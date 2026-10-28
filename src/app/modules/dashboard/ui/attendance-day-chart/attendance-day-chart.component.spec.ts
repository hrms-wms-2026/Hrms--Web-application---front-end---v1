import { TestBed } from '@angular/core/testing';
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

function render(points: TeamAttendanceTrendPoint[], compact = false): HTMLElement {
  const fixture = TestBed.createComponent(AttendanceDayChartComponent);
  fixture.componentRef.setInput('points', points);
  fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AttendanceDayChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws one bar per day with weekday labels for a week', () => {
    const el = render(week());

    expect(el.querySelectorAll('[data-testid=day-bar]').length).toBe(7);
    expect(el.querySelector('[data-testid=day-label]')?.textContent?.trim()).toBe('Mon');
  });

  it('draws one bar per day with day numbers for a month', () => {
    const points = Array.from({ length: 31 }, (_, i) => point(`2026-10-${String(i + 1).padStart(2, '0')}`, 1));
    const el = render(points);

    expect(el.querySelectorAll('[data-testid=day-bar]').length).toBe(31);
    expect(el.querySelector('[data-testid=day-label]')?.textContent?.trim()).toBe('1');
  });

  it('shows every 5th day label when compact in a month', () => {
    const points = Array.from({ length: 30 }, (_, i) => point(`2026-09-${String(i + 1).padStart(2, '0')}`, 1));
    const labels = [...render(points, true).querySelectorAll('[data-testid=day-label]')].map((l) => l.textContent?.trim());

    expect(labels.filter((l) => l).length).toBe(7); // 1, 5, 10, 15, 20, 25, 30
  });

  it('stacks segments proportionally to the busiest day', () => {
    const points = week();
    points[0] = point('2026-10-26', 6, 2, 2);
    points[1] = point('2026-10-27', 3, 0, 2);
    const el = render(points);
    const bars = el.querySelectorAll<HTMLElement>('[data-testid=day-bar]');

    const seg = (bar: HTMLElement, kind: string) => bar.querySelector<HTMLElement>(`[data-segment=${kind}]`)?.style.height;
    expect(seg(bars[0], 'present')).toBe('60%');
    expect(seg(bars[0], 'late')).toBe('20%');
    expect(seg(bars[0], 'absent')).toBe('20%');
    expect(seg(bars[1], 'present')).toBe('30%');
    expect(bars[2].querySelector('[data-segment]')).toBeNull();
  });

  it('labels the chart for screen readers', () => {
    const points = week();
    points[0] = point('2026-10-26', 9, 0, 1);
    const chart = render(points).querySelector('[role=img]');

    expect(chart?.getAttribute('aria-label')).toContain('Mon 26 Oct: 90%');
  });
});
