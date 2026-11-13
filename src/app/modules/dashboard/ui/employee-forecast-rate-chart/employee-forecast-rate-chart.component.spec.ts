import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_FORECAST_ITEMS } from '../../utils/team-employee-forecast.testing';
import {
  EmployeeForecastRateChartComponent,
  rateChartPeople,
} from './employee-forecast-rate-chart.component';

describe('EmployeeForecastRateChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("draws each person's rate beside the rate they need, red over 100%", () => {
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
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain(
      'Ann: 38% rate, needs 130%',
    );
  });

  it('picks the people with the most overtime', () => {
    expect(rateChartPeople(EMPLOYEE_FORECAST_ITEMS, 2).map((e) => e.name)).toEqual(['Ann', 'Bob']);
  });

  it('plots rates at most 200% and keeps the real figure of a taller required rate for the hover', () => {
    const fixture = TestBed.createComponent(EmployeeForecastRateChartComponent);
    fixture.componentRef.setInput('items', [
      { ...EMPLOYEE_FORECAST_ITEMS[0], requiredRate: 8.53 },
      EMPLOYEE_FORECAST_ITEMS[1],
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    // A 0-100-200% axis, not 0-5K%: the 38% task rate stays visible.
    expect(el.textContent).toContain('200%');
    expect(el.textContent).not.toContain('K%');
    expect(
      (cols[0].querySelector('[data-testid=bar-chart-pair]') as HTMLElement).style.height,
    ).toBe('100%');
    expect(
      (cols[0].querySelector('[data-testid=bar-chart-stack]') as HTMLElement).style.height,
    ).toBe('19%');
    expect(el.querySelector('[data-testid=bar-chart-badge]')).toBeNull();
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('needs 853%');
  });

  it('draws the rate limit as a dash on every bar and colours a required rate above it as overload', () => {
    const fixture = TestBed.createComponent(EmployeeForecastRateChartComponent);
    fixture.componentRef.setInput('items', EMPLOYEE_FORECAST_ITEMS.slice(0, 2));
    fixture.componentRef.setInput('maxTaskRate', 0.9);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    expect(cols[0].querySelector('[data-testid=bar-chart-marker]')).not.toBeNull();
    expect(el.textContent).toContain('90% limit');
    const required = (i: number) =>
      (cols[i].querySelector('[data-segment=required]') as HTMLElement).style.background;
    // Ann needs 130% (> 90%): overload; Bob needs 70%: the amber "higher rate".
    expect(required(0)).not.toBe(required(1));
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Ann');
  });

  it('draws no badges or frames over the bars (the hover has the details)', () => {
    const fixture = TestBed.createComponent(EmployeeForecastRateChartComponent);
    fixture.componentRef.setInput('items', [
      { ...EMPLOYEE_FORECAST_ITEMS[0], requiredRate: 8.53 },
      EMPLOYEE_FORECAST_ITEMS[1],
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=bar-chart-badge]')).toBeNull();
    expect(el.querySelector('.bc-col--alert, [data-testid=bar-chart-alert]')).toBeNull();
  });
});
