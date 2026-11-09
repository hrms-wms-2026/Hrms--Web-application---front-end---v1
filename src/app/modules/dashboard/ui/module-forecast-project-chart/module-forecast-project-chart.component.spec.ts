import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { moduleForecastResponse } from '../../utils/team-module-forecast.testing';
import {
  ModuleForecastProjectChartComponent,
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
});
