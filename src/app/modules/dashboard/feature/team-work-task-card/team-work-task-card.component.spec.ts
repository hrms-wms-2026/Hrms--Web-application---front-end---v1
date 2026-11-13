import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamWorkTaskApiService } from '../../data-access/team-work-task-api.service';
import { TeamWorkTaskHoursResponse, TeamWorkTaskQuery } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { DASHBOARD_MINI_DONUT_PX } from '../../../../shared/ui/charts/utils/dashboard-donut.util';
import { workTaskResponse } from '../../utils/team-work-task.testing';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
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

  it('a 2-row card shows the shared strip: the donut with task share in it, no stacked bar', () => {
    setup();
    const el = resize(206, 204);
    expect(q(el, 'wt-mini')).toBeTruthy();
    expect((q(el, 'summary-strip-donut') as HTMLElement).style.width).toBe(`${DASHBOARD_MINI_DONUT_PX}px`);
    expect(q(el, 'wt-utilization')?.textContent?.trim()).toBe('50%');
    expect(q(el, 'wt-status-bar')).toBeNull();
  });

  it('a wide 2-row card adds the key and four summary cards from the data it already has', () => {
    stubResizeObserver();
    setup();
    const el = resize(1812, 204);
    FakeResizeObserver.instances.at(-1)!.trigger(1812 - 32, 150);
    fixture.detectChanges();
    expect(el.querySelector('app-donut-key')).toBeTruthy();
    expect(el.querySelectorAll('app-dashboard-summary-card').length).toBe(4);
    expect(el.textContent).toContain('Biggest gap');
    expect(get).toHaveBeenCalledTimes(1);

    (el.querySelectorAll('[data-testid="summary-card"]')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(fixture.componentInstance.detailSection()).toBe('employees');
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

    // Taller, two summary cards take the tiles' place first (the chart then needs more height).
    el = resize(760, 528);
    expect(q(el, 'wt-tiles')).toBeNull();
    expect(q(el, 'wt-summary-row')).toBeTruthy();
    expect(q(el, 'work-task-chart')).toBeNull();

    el = resize(760, 636);
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

  it('a tall card swaps the tiles for two summary cards of what it is not already showing', () => {
    setup();
    // 4 x 7 at 1920px: the share figure, the daily chart and the ranking are all on the card.
    const el = resize(596, 744);
    expect(q(el, 'wt-tiles')).toBeNull();
    const titles = [...el.querySelectorAll('[data-testid="wt-summary-row"] [data-testid="summary-title"]')].map((t) => t.textContent?.trim());
    expect(titles).toEqual(['Tasks completed', 'Break time']);
    expect(q(el, 'work-task-chart')).toBeTruthy();
    expect(q(el, 'wt-ranking')).toBeTruthy();

    (el.querySelector('[data-testid="wt-summary-row"] [data-testid="summary-card"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailSection()).toBe('summary');
  });
});
