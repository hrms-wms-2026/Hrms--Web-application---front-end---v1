import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamWorkTaskApiService } from '../../data-access/team-work-task-api.service';
import { TeamWorkTaskHoursResponse, TeamWorkTaskQuery } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { DASHBOARD_MINI_DONUT_PX } from '../../utils/dashboard-donut.util';
import { workTaskResponse } from '../../utils/team-work-task.testing';
import { TeamWorkTaskCardComponent } from './team-work-task-card.component';

describe('TeamWorkTaskCardComponent', () => {
  let fixture: ComponentFixture<TeamWorkTaskCardComponent>;
  let get: ReturnType<typeof vi.fn<(q: TeamWorkTaskQuery) => unknown>>;

  function setup(data: TeamWorkTaskHoursResponse = workTaskResponse()): void {
    get = vi.fn((_q: TeamWorkTaskQuery) => of(data));
    TestBed.configureTestingModule({
      imports: [TeamWorkTaskCardComponent],
      providers: [
        TeamWorkTaskStore,
        { provide: TeamWorkTaskApiService, useValue: { get: (q: TeamWorkTaskQuery) => get(q) } },
      ],
    });
    fixture = TestBed.createComponent(TeamWorkTaskCardComponent);
    fixture.detectChanges();
  }

  function resize(width: number, height: number): HTMLElement {
    fixture.componentInstance.applySize({ width, height });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);
  const all = (el: HTMLElement, id: string) => el.querySelectorAll(`[data-testid=${id}]`);

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads the week on start', () => {
    setup();
    expect(get).toHaveBeenCalledWith({ period: 'week', anchor: null });
    expect(q(fixture.nativeElement, 'team-work-task-card')).toBeTruthy();
  });

  it('a 2-row card shows the donut with task share; wide, a stacked bar and legend', () => {
    setup();
    let el = resize(206, 204);
    expect(q(el, 'wt-mini')).toBeTruthy();
    expect((q(el, 'wt-donut') as HTMLElement).style.width).toBe(`${DASHBOARD_MINI_DONUT_PX}px`);
    expect(q(el, 'wt-utilization')?.textContent?.trim()).toBe('50%');
    expect(q(el, 'wt-figure')).toBeNull();

    el = resize(292, 204);
    expect(q(el, 'wt-figure')?.textContent).toContain('60h task of 120h worked');

    el = resize(760, 204);
    expect(q(el, 'wt-donut')).toBeNull();
    expect(q(el, 'wt-status-bar')).toBeTruthy();
    expect(el.textContent).toContain('Other work time');
  });

  it('a narrow tall card stacks the legend under the donut and hides the period switch', () => {
    setup();
    const el = resize(315, 420);
    expect(q(el, 'wt-layout')?.getAttribute('data-view')).toBe('xs');
    expect(el.querySelector('select')).toBeNull();
    expect(all(el, 'wt-legend-row').length).toBe(3);
  });

  it('growing taller adds tiles, then the chart, then the ranking', () => {
    setup();
    let el = resize(760, 312);
    expect(q(el, 'wt-tiles')).toBeNull();

    el = resize(760, 420);
    expect(q(el, 'wt-tiles')).toBeTruthy();
    expect(q(el, 'wt-tile-task')?.textContent).toContain('60h');
    expect(q(el, 'wt-trend')).toBeNull();
    expect(q(el, 'wt-delta')?.textContent?.trim()).toBe('↑ 5 pp vs last week');

    el = resize(760, 528);
    expect(q(el, 'work-task-chart')).toBeTruthy();
    expect(q(el, 'wt-ranking')).toBeNull();

    el = resize(760, 744);
    expect(all(el, 'wt-rank-row').length).toBeGreaterThanOrEqual(3);
    expect(all(el, 'wt-rank-row')[0].textContent).toContain('Ann');
  });

  it('has no period dropdown (it lives in the popup); the store period still reloads it', () => {
    setup();
    const el = resize(760, 420);
    expect(q(el, 'wt-period')).toBeNull();
    TestBed.inject(TeamWorkTaskStore).setPeriod('month');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith({ period: 'month', anchor: '2026-10-28' });
    expect((q(el, 'wt-next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('an empty team shows the empty state', () => {
    setup(workTaskResponse({ teamSize: 0, employees: [] }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No one in your team yet.',
    );
  });

  it('the expand button opens the popup', () => {
    setup();
    fixture.componentInstance.openDetail();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
  });
});
