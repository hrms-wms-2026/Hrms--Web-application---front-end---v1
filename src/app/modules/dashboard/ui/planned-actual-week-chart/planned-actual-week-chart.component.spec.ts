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

  const cols = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-testid="bar-chart-col"]')];
  const label = (c: HTMLElement) => c.querySelector('[data-testid="bar-chart-label"]')!.textContent!.trim();

  it('seven columns labelled by weekday, today drawn as the running one', () => {
    const el = render();
    expect(cols(el).length).toBe(7);
    expect(cols(el).map(label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(cols(el)[2].querySelector('[data-testid="bar-chart-label"]')!.classList).toContain('bc-label--current');
  });

  it('a planned bar beside the actual bar (in plan, outside slot, no plan); future days planned only', () => {
    const el = render();
    const c = cols(el);
    expect(c[0].querySelector('[data-testid="bar-chart-stack"] [data-segment="planned"]')).toBeTruthy();
    const actual = c[0].querySelector('[data-testid="bar-chart-pair"]')!;
    expect([...actual.querySelectorAll('[data-segment]')].map((s) => s.getAttribute('data-segment'))).toEqual(['scheduled', 'outside', 'noPlan']);
    expect(c[2].querySelector('[data-testid="bar-chart-pair"]')).toBeTruthy();
    expect(c[3].querySelector('[data-testid="bar-chart-pair"]')).toBeNull();
    expect(c[3].querySelector('[data-testid="bar-chart-stack"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="bar-chart-legend"]')!.textContent).toContain('Outside slot');
  });

  it("each day's coverage is in its hover readout and tooltip, unless switched off", () => {
    const fixture = TestBed.createComponent(PlannedActualWeekChartComponent);
    fixture.componentRef.setInput('days', WEEK);
    fixture.componentRef.setInput('today', '2026-10-28');
    fixture.componentRef.setInput('heading', 'This week');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="bar-chart-value"]')!.textContent!.trim()).toBe('15.3h actual');
    cols(el)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="bar-chart-value"]')!.textContent!.trim()).toBe('7h actual');
    expect(el.querySelector('[data-testid="bar-chart-chip"]')!.textContent!.trim()).toBe('of 8h planned · coverage 62.5%');
    expect(cols(el)[0].title).toContain('coverage 62.5%');
    TestBed.resetTestingModule();
    expect(cols(render({ coverageLine: false }))[0].title).not.toContain('coverage');
  });

  it('labels override the weekday names (month buckets)', () => {
    const el = render({ labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'] });
    expect(label(cols(el)[0])).toBe('W1');
  });

  it('aria-label summary names planned, actual and coverage per day', () => {
    const text = render().querySelector('[role="img"]')!.getAttribute('aria-label')!;
    expect(text).toContain('Mon: planned 8h, actual 7h, coverage 62.5%');
    expect(text).toContain('Thu: planned 4h');
  });
});
