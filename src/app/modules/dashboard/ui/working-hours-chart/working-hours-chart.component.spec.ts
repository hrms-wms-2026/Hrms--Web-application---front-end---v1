import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TeamWorkingHoursDay } from '../../models/my-team-today.model';
import { WorkingHoursChartComponent } from './working-hours-chart.component';

const DAYS: TeamWorkingHoursDay[] = [
  { date: '2026-10-26', workedMinutes: 960, breakMinutes: 120, onLeaveCount: 1, peopleWithRecord: 2 },
  { date: '2026-10-27', workedMinutes: 480, breakMinutes: 60, onLeaveCount: 0, peopleWithRecord: 1 },
  { date: '2026-10-28', workedMinutes: 0, breakMinutes: 0, onLeaveCount: 2, peopleWithRecord: 0 }
];

describe('WorkingHoursChartComponent (on the shared dashboard bar chart)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(WorkingHoursChartComponent);
    fixture.componentRef.setInput('days', DAYS);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const cols = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-testid=bar-chart-col]')];
  const headline = (el: HTMLElement) =>
    [...el.querySelectorAll('[data-testid=bar-chart-headline] .bc-head-label, [data-testid=bar-chart-headline] .bc-head-row > span')].map(
      (n) => n.textContent?.trim()
    );

  it('stacks worked and break hours per day against a round hour axis, weekday labels, no leave marks', () => {
    const { el } = setup();
    expect(cols(el).length).toBe(3);
    expect(cols(el).map((c) => c.querySelector('[data-testid=bar-chart-label]')?.textContent?.trim())).toEqual(['Mon', 'Tue', 'Wed']);
    // Busiest day 18h (16h worked + 2h break): a 0-10-20h axis.
    expect([...el.querySelectorAll('[data-testid=bar-chart-axis] > span')].map((s) => s.textContent?.trim())).toEqual(['20h', '10h', '0h']);
    expect(cols(el)[0].querySelector<HTMLElement>('[data-testid=bar-chart-stack]')?.style.height).toBe('90%');
    expect(cols(el)[0].querySelector<HTMLElement>('[data-segment=worked]')?.style.height).toBe(`${(16 / 18) * 100}%`);
    expect(cols(el)[2].querySelector('[data-testid=bar-chart-stack]')).toBeNull();
    expect(el.querySelector('[data-testid=bar-chart-badge]')).toBeNull();
    expect(el.querySelector('[data-testid=bar-chart-headline]')).toBeNull();
  });

  it('with a heading, reads the week then the hovered day, with the average per person when asked', () => {
    const { fixture, el } = setup({ heading: 'Working hours', teamAverage: true });
    expect(headline(el)).toEqual(['Working hours', '24h worked', '8h avg per person']);

    cols(el)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(headline(el)).toEqual(['Mon 26 Oct', '16h worked', '8h per person']);
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('8h average per person');
  });

  it('without the average, the hover reads the break', () => {
    const { fixture, el } = setup({ heading: 'Working hours' });
    cols(el)[1].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(headline(el)).toEqual(['Tue 27 Oct', '8h worked', '1h break']);
  });

  it('leave marks only when showLeave, with the count in the tooltip', () => {
    expect(setup({ showLeave: false }).el.querySelector('[data-testid=bar-chart-badge]')).toBeNull();
    TestBed.resetTestingModule();
    const marks = [...setup({ showLeave: true }).el.querySelectorAll<HTMLElement>('[data-testid=bar-chart-badge]')];
    expect(marks.length).toBe(2);
    expect(marks[0].textContent!.trim()).toBe('1');
    expect(marks[0].getAttribute('title')).toBe('1 on leave');
  });
});
