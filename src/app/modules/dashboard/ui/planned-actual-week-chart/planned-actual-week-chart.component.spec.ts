import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannedActualDay } from '../../utils/planned-actual-format.util';
import { PlannedActualWeekChartComponent } from './planned-actual-week-chart.component';

const WEEK: PlannedActualDay[] = [
  {
    date: '2026-10-26',
    planned: 480,
    scheduled: 300,
    outside: 60,
    noPlan: 60,
    coveragePercent: 62.5,
  },
  {
    date: '2026-10-27',
    planned: 480,
    scheduled: 400,
    outside: 0,
    noPlan: 0,
    coveragePercent: 83.3,
  },
  {
    date: '2026-10-28',
    planned: 480,
    scheduled: 100,
    outside: 0,
    noPlan: 0,
    coveragePercent: null,
  },
  { date: '2026-10-29', planned: 240, scheduled: 0, outside: 0, noPlan: 0, coveragePercent: null },
  { date: '2026-10-30', planned: 240, scheduled: 0, outside: 0, noPlan: 0, coveragePercent: null },
  { date: '2026-10-31', planned: 0, scheduled: 0, outside: 0, noPlan: 0, coveragePercent: null },
  { date: '2026-11-01', planned: 0, scheduled: 0, outside: 0, noPlan: 0, coveragePercent: null },
];

describe('PlannedActualWeekChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(
    inputs: { today?: string | null; coverageLine?: boolean; labels?: string[] } = {},
  ) {
    TestBed.configureTestingModule({ imports: [PlannedActualWeekChartComponent] });
    const fixture = TestBed.createComponent(PlannedActualWeekChartComponent);
    fixture.componentRef.setInput('days', WEEK);
    fixture.componentRef.setInput('today', inputs.today ?? '2026-10-28');
    if (inputs.coverageLine !== undefined)
      fixture.componentRef.setInput('coverageLine', inputs.coverageLine);
    if (inputs.labels) fixture.componentRef.setInput('labels', inputs.labels);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('seven columns labelled by weekday, today marked', () => {
    const el = render();
    const cols = [...el.querySelectorAll('[data-testid="paw-col"]')];
    expect(cols.length).toBe(7);
    expect(cols.map((c) => c.querySelector('.paw-label')!.textContent!.trim())).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(cols[2].classList.contains('paw-col--today')).toBe(true);
  });

  it('future days have no actual bar, past and today do', () => {
    const el = render();
    const cols = [...el.querySelectorAll('[data-testid="paw-col"]')];
    expect(cols[0].querySelector('[data-testid="paw-actual"]')).toBeTruthy();
    expect(cols[2].querySelector('[data-testid="paw-actual"]')).toBeTruthy();
    expect(cols[3].querySelector('[data-testid="paw-actual"]')).toBeNull();
    expect(cols[3].querySelector('[data-testid="paw-planned"]')).toBeTruthy();
  });

  it('coverage line skips null days', () => {
    const el = render();
    expect(el.querySelectorAll('[data-testid="paw-coverage-point"]').length).toBe(2);
    expect(el.querySelector('[data-testid="paw-coverage"]')).toBeTruthy();
  });

  it('no coverage line when it is off', () => {
    expect(
      render({ coverageLine: false }).querySelector('[data-testid="paw-coverage"]'),
    ).toBeNull();
  });

  it('labels override the weekday names (month buckets)', () => {
    const el = render({ labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'] });
    expect(el.querySelector('[data-testid="paw-col"] .paw-label')!.textContent!.trim()).toBe('W1');
  });

  it('aria-label summary names planned, actual and coverage per day', () => {
    const label = render().querySelector('[role="img"]')!.getAttribute('aria-label')!;
    expect(label).toContain('Mon: planned 8h, actual 7h, coverage 62.5%');
    expect(label).toContain('Thu: planned 4h');
  });
});
