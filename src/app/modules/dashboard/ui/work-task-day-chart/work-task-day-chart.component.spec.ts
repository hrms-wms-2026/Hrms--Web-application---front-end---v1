import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { workTaskTrend } from '../../utils/team-work-task.testing';
import { WorkTaskDayChartComponent } from './work-task-day-chart.component';

describe('WorkTaskDayChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(highlight: string | null = null): HTMLElement {
    const fixture = TestBed.createComponent(WorkTaskDayChartComponent);
    fixture.componentRef.setInput('points', workTaskTrend());
    fixture.componentRef.setInput('highlight', highlight);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws a worked and a task bar per day on one scale', () => {
    const el = render();
    const bars = el.querySelectorAll('[data-testid=work-task-bar]');
    expect(bars.length).toBe(7);
    const worked = bars[0].querySelector('[data-segment=worked]') as HTMLElement;
    const task = bars[0].querySelector('[data-segment=task]') as HTMLElement;
    expect(worked.style.height).toBe('100%');
    expect(task.style.height).toBe('50%');
    expect(bars[0].textContent).toContain('Mon');
    expect(el.querySelector('[role=img]')?.getAttribute('aria-label')).toContain(
      '40h worked, 20h task',
    );
  });

  it('dims every day but the highlighted one', () => {
    const el = render('2026-10-27');
    const bars = [...el.querySelectorAll('[data-testid=work-task-bar]')];
    expect(bars.filter((b) => b.classList.contains('wtc-col--dim')).length).toBe(6);
  });
});
