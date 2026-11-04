import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TeamWorkingHoursDay } from '../../models/my-team-today.model';
import { WorkingHoursChartComponent } from './working-hours-chart.component';

const DAYS: TeamWorkingHoursDay[] = [
  {
    date: '2026-10-26',
    workedMinutes: 960,
    breakMinutes: 120,
    onLeaveCount: 1,
    peopleWithRecord: 2,
  },
  {
    date: '2026-10-27',
    workedMinutes: 480,
    breakMinutes: 60,
    onLeaveCount: 0,
    peopleWithRecord: 1,
  },
  { date: '2026-10-28', workedMinutes: 0, breakMinutes: 0, onLeaveCount: 2, peopleWithRecord: 0 },
];

describe('WorkingHoursChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(inputs: { teamAverage?: boolean; showLeave?: boolean } = {}) {
    TestBed.configureTestingModule({ imports: [WorkingHoursChartComponent] });
    const fixture = TestBed.createComponent(WorkingHoursChartComponent);
    fixture.componentRef.setInput('days', DAYS);
    if (inputs.teamAverage !== undefined)
      fixture.componentRef.setInput('teamAverage', inputs.teamAverage);
    if (inputs.showLeave !== undefined)
      fixture.componentRef.setInput('showLeave', inputs.showLeave);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('old usage unchanged: stacked worked and break bars against the busiest day, no line, no leave marks', () => {
    const el = render();

    expect(el.querySelectorAll('[data-testid="hours-bar"]').length).toBe(3);
    const worked = el.querySelectorAll<HTMLElement>('[data-segment="worked"]');
    expect(worked[0].style.height).toBe('88.9%');
    expect(el.querySelector('[data-testid="hours-average"]')).toBeNull();
    expect(el.querySelector('[data-testid="hours-leave"]')).toBeNull();
  });

  it('draws the team average line: worked minutes per person with a record, skipping days without one', () => {
    const el = render({ teamAverage: true });

    const line = el.querySelector('[data-testid="hours-average"]')!;
    expect(line).toBeTruthy();
    // 960/2 = 480 and 480/1 = 480 per person; the third day has no record and no point.
    expect(el.querySelectorAll('[data-testid="hours-average-point"]').length).toBe(2);
    expect(
      el.querySelector('[data-testid="working-hours-chart"]')!.getAttribute('aria-label'),
    ).toContain('8h average per person');
  });

  it('leave marks only when showLeave, with the count in the tooltip', () => {
    expect(render({ showLeave: false }).querySelector('[data-testid="hours-leave"]')).toBeNull();
    TestBed.resetTestingModule();

    const el = render({ showLeave: true });
    const marks = [...el.querySelectorAll<HTMLElement>('[data-testid="hours-leave"]')];
    expect(marks.length).toBe(2);
    expect(marks[0].textContent!.trim()).toBe('1');
    expect(marks[0].getAttribute('title')).toBe('1 on leave');
  });
});
