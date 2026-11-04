import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannedActualRow } from '../../utils/planned-actual-format.util';
import { PlannedActualDayChartComponent } from './planned-actual-day-chart.component';

const rows = (n: number): PlannedActualRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    label: `Person ${i}`,
    planned: 60,
    scheduled: 30,
    outside: 0,
    noPlan: 0,
    completion: 50,
  }));

describe('PlannedActualDayChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(data: PlannedActualRow[], maxRows?: number) {
    TestBed.configureTestingModule({ imports: [PlannedActualDayChartComponent] });
    const fixture = TestBed.createComponent(PlannedActualDayChartComponent);
    fixture.componentRef.setInput('rows', data);
    if (maxRows !== undefined) fixture.componentRef.setInput('maxRows', maxRows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders maxRows rows', () => {
    expect(render(rows(8), 3).querySelectorAll('[data-testid="pad-row"]').length).toBe(3);
    TestBed.resetTestingModule();
    expect(render(rows(2), 5).querySelectorAll('[data-testid="pad-row"]').length).toBe(2);
  });

  it('scale covers overtime: the planned bar is 40% when actual is 150 of planned 60, label uncapped', () => {
    const el = render([
      {
        id: 'a',
        label: 'Ada',
        planned: 60,
        scheduled: 100,
        outside: 20,
        noPlan: 30,
        completion: null,
      },
    ]);

    expect((el.querySelector('[data-testid="pad-planned"]') as HTMLElement).style.width).toBe(
      '40%',
    );
    const actual = [...el.querySelectorAll<HTMLElement>('[data-testid="pad-actual"] span')].map(
      (s) => s.style.width,
    );
    expect(actual).toEqual(['66.7%', '13.3%', '20%']);
    expect(el.querySelector('[data-testid="pad-actual-text"]')!.textContent!.trim()).toBe('2h 30m');
    expect(el.querySelector('[data-testid="pad-completion"]')!.textContent!.trim()).toBe('—');
  });

  it('has an aria summary', () => {
    const el = render(rows(1));
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain(
      'Person 0: planned 1h, actual 30m',
    );
  });
});
