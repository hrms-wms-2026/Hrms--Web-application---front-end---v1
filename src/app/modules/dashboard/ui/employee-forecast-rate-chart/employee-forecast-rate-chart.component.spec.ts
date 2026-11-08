import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_FORECAST_ITEMS } from '../../utils/team-employee-forecast.testing';
import { EmployeeForecastRateChartComponent, rateChartPeople } from './employee-forecast-rate-chart.component';

describe('EmployeeForecastRateChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws each person\'s rate beside the rate they need, red over 100%', () => {
    const fixture = TestBed.createComponent(EmployeeForecastRateChartComponent);
    fixture.componentRef.setInput('items', EMPLOYEE_FORECAST_ITEMS);
    fixture.componentRef.setInput('teamRate', 0.4);
    fixture.componentRef.setInput('heading', 'Task rate vs required');
    fixture.componentRef.setInput('limit', 3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    expect(cols.length).toBe(3);
    expect(cols[0].textContent).toContain('Ann');
    expect(cols[0].querySelector('[data-segment=rate]')).not.toBeNull();
    expect(cols[0].querySelector('[data-segment=required]')).not.toBeNull();
    expect(el.textContent).toContain('40% team rate');
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Ann: 38% rate, needs 130%');
  });

  it('picks the people with the most overtime', () => {
    expect(rateChartPeople(EMPLOYEE_FORECAST_ITEMS, 2).map((e) => e.name)).toEqual(['Ann', 'Bob']);
  });
});
