import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { moduleForecastResponse } from '../../utils/team-module-forecast.testing';
import {
  ModuleForecastProjectChartComponent,
  chartFit,
  shortBarLabel,
} from './module-forecast-project-chart.component';

describe('ModuleForecastProjectChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws remaining beside predicted per project, with the capacity dash and an alert border', () => {
    const fixture = TestBed.createComponent(ModuleForecastProjectChartComponent);
    fixture.componentRef.setInput('projects', moduleForecastResponse().projects);
    fixture.componentRef.setInput('heading', 'Overtime by project');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    expect(cols.length).toBe(2);
    expect(cols[0].querySelector('[data-segment=remaining]')).not.toBeNull();
    expect(cols[0].querySelector('[data-segment=predicted]')).not.toBeNull();
    expect(cols[0].textContent).toContain('Atlas');
    expect(el.textContent).toContain("+950 h won't fit");
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain(
      'Atlas: 900 h left, 700 h predicted',
    );
  });

  it('shortens long names', () => {
    expect(shortBarLabel('Very long project name')).toBe('Very long…');
    expect(shortBarLabel('Atlas')).toBe('Atlas');
  });

  it('scales the axis to the bars: a capacity far above them is left out of the plot, not the scale', () => {
    const base = moduleForecastResponse().projects[0];
    const fixture = TestBed.createComponent(ModuleForecastProjectChartComponent);
    fixture.componentRef.setInput('projects', [
      { ...base, projectId: 'big', name: 'Onexso', capacityHours: 20900, remainingHours: 900 },
      { ...base, projectId: 'small', name: 'Atlas', capacityHours: 900, remainingHours: 800 },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const axis = el.querySelector('[data-testid=bar-chart-axis]')?.textContent ?? '';
    // 0 – 500 – 1K h, not 0 – 10K – 20K h.
    expect(axis.replace(/\s+/g, '')).toBe('1Kh500h0h');
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    // Onexso's 18,810 h dash would set a 20Kh axis: it is left out (the hover still reads it).
    expect(cols[0].querySelector('[data-testid=bar-chart-marker]')).toBeNull();
    expect(cols[1].querySelector('[data-testid=bar-chart-marker]')).not.toBeNull();
    expect(el.querySelector('.bc-col--alert, [data-testid=bar-chart-alert]')).toBeNull();
  });

  it('draws no badges or red frames on the bars', () => {
    const fixture = TestBed.createComponent(ModuleForecastProjectChartComponent);
    fixture.componentRef.setInput('projects', moduleForecastResponse().projects);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=bar-chart-badge]')).toBeNull();
    expect(el.querySelector('.bc-col--alert')).toBeNull();
  });

  it('a narrow chart drops the axis and shortens the dash legend to one line', () => {
    const fixture = TestBed.createComponent(ModuleForecastProjectChartComponent);
    fixture.componentRef.setInput('projects', moduleForecastResponse().projects);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=bar-chart-axis]')).not.toBeNull();
    expect(el.textContent).toContain('Capacity at 90%');
    fixture.componentRef.setInput('narrow', true);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid=bar-chart-axis]')).toBeNull();
    expect(el.textContent).toContain('90% cap');
    expect(el.textContent).not.toContain('Capacity at');
  });

  it('a narrow card shows the top projects with readable labels and "+N more"', () => {
    const base = moduleForecastResponse().projects[0];
    const projects = [
      'E-procurement suite',
      'The Atlas rebuild',
      'Event hub',
      'Docs',
      'Billing',
    ].map((name, i) => ({ ...base, projectId: `p${i}`, name, overtimeHours: 100 - i }));
    const fit = chartFit(270);
    const fixture = TestBed.createComponent(ModuleForecastProjectChartComponent);
    fixture.componentRef.setInput('projects', projects);
    fixture.componentRef.setInput('limit', fit.bars);
    fixture.componentRef.setInput('labelChars', fit.labelChars);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cols = el.querySelectorAll('[data-testid=bar-chart-col]');
    expect(cols.length).toBe(3);
    expect(cols[0].textContent).toContain('E-procure…');
    expect(cols[2].textContent).toContain('Event hub');
    expect(el.querySelector('[data-testid=project-chart-more]')?.textContent?.trim()).toBe(
      '+2 more projects in the popup',
    );
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain(
      'E-procurement suite',
    );
  });

  it('fits bars and label lengths to the body width', () => {
    expect(chartFit(270)).toEqual({ bars: 3, labelChars: 10 });
    expect(chartFit(470)).toEqual({ bars: 6, labelChars: 10 });
    expect(chartFit(2000).bars).toBe(8);
    expect(chartFit(80).bars).toBe(2);
    // Without the axis the plot gets the whole body.
    expect(chartFit(230, 64, 8, 0).bars).toBe(3);
    expect(chartFit(230).bars).toBe(2);
  });
});
