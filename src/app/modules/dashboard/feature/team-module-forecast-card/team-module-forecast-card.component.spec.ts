import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamModuleForecastApiService } from '../../data-access/team-module-forecast-api.service';
import {
  ModuleForecastQuery,
  ModuleForecastResponse,
} from '../../models/team-module-forecast.model';
import { TeamModuleForecastStore } from '../../state/team-module-forecast.store';
import { DASHBOARD_MINI_DONUT_PX } from '../../utils/dashboard-donut.util';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { moduleForecastResponse } from '../../utils/team-module-forecast.testing';
import { TeamModuleForecastCardComponent } from './team-module-forecast-card.component';

describe('TeamModuleForecastCardComponent', () => {
  let fixture: ComponentFixture<TeamModuleForecastCardComponent>;
  let get: ReturnType<typeof vi.fn<(q: ModuleForecastQuery) => unknown>>;

  function setup(data: ModuleForecastResponse = moduleForecastResponse()): void {
    get = vi.fn((_q: ModuleForecastQuery) => of(data));
    TestBed.configureTestingModule({
      imports: [TeamModuleForecastCardComponent],
      providers: [
        TeamModuleForecastStore,
        {
          provide: TeamModuleForecastApiService,
          useValue: { get: (q: ModuleForecastQuery) => get(q) },
        },
      ],
    });
    fixture = TestBed.createComponent(TeamModuleForecastCardComponent);
    fixture.detectChanges();
  }

  function resize(width: number, height: number): HTMLElement {
    fixture.componentInstance.applySize({ width, height });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);
  const all = (el: HTMLElement, id: string) => el.querySelectorAll(`[data-testid=${id}]`);

  beforeEach(() => vi.stubGlobal('ResizeObserver', undefined));

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads the top 10 modules by overtime on start', () => {
    setup();
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'overtime', page: 1, pageSize: 10 }),
    );
    expect(q(fixture.nativeElement, 'team-module-forecast-card')).toBeTruthy();
  });

  it('a 2x2 card shows the shared strip with the team rate in the donut', () => {
    setup();
    const el = resize(206, 204);
    expect(q(el, 'mf-mini')).toBeTruthy();
    expect((q(el, 'summary-strip-donut') as HTMLElement).style.width).toBe(
      `${DASHBOARD_MINI_DONUT_PX}px`,
    );
    expect(q(el, 'mf-rate')?.textContent?.trim()).toBe('42%');
    expect(el.textContent).toContain('4-wk rate');
    expect(el.textContent).not.toContain('task rate · last 4 wk');
  });

  it('a wide 2-row card adds the key and four summary cards; a card opens its popup section', () => {
    stubResizeObserver();
    setup();
    const el = resize(1812, 204);
    FakeResizeObserver.instances.at(-1)!.trigger(1812 - 32, 150);
    fixture.detectChanges();
    expect(el.querySelectorAll('app-dashboard-summary-card').length).toBe(4);
    expect(el.textContent).toContain('Milestones at risk');
    (el.querySelectorAll('[data-testid="summary-card"]')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailSection()).toBe('modules');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
  });

  it('a narrow tall card stacks the key and the figure under the donut', () => {
    setup();
    const el = resize(315, 420);
    expect(q(el, 'mf-layout')?.getAttribute('data-view')).toBe('xs');
    expect(all(el, 'mf-legend-row').length).toBe(3);
    expect(q(el, 'mf-hero-figure')?.textContent?.trim()).toBe('~950 h');
  });

  it('the hero reads the overtime and the rate the team needs', () => {
    setup();
    let el = resize(760, 312);
    expect(q(el, 'mf-hero-figure')?.textContent?.trim()).toBe('~950 h');
    expect(q(el, 'mf-caption')?.textContent?.trim()).toBe('Needs 58% task rate · now 42%');
    expect(q(el, 'mf-tile-overtime')?.textContent).toContain('950 h');
    // Taller, two summary cards it is not showing take the tiles' place.
    el = resize(760, 420);
    expect(q(el, 'mf-tiles')).toBeNull();
    expect(q(el, 'mf-summary-row')).toBeTruthy();
  });

  it('growing taller adds the project chart, then the modules at risk', () => {
    setup();
    let el = resize(760, 528);
    expect(q(el, 'module-forecast-project-chart')).toBeNull();
    el = resize(760, 636);
    expect(q(el, 'module-forecast-project-chart')).toBeTruthy();
    el = resize(760, 860);
    const rows = all(el, 'mf-rank-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Billing');
    // Overload first: the filled badge, with the current and required rate under the name.
    expect(rows[0].querySelector('[data-testid=mf-overload]')?.textContent?.trim()).toBe(
      '⚠ Overload',
    );
    expect(rows[0].querySelector('[data-testid=mf-row-rate]')?.textContent?.trim()).toBe(
      '42% → 120% · limit 90%',
    );
    expect(rows[1].querySelector('[data-testid=mf-overload]')).toBeNull();
    expect(rows[1].textContent).toContain('+');
    expect(q(el, 'mf-hero-overload')?.textContent).toContain('1 in overload');
  });

  it('nothing short: the hero says On track and the ranking says so', () => {
    const base = moduleForecastResponse();
    setup(
      moduleForecastResponse({
        totals: { ...base.totals, overtimeHours: 0, remainingHours: 0, raiseRate: 0, overload: 0 },
        items: base.items.map((m) => ({ ...m, status: 'on_track', overtimeHours: 0 })),
      }),
    );
    const el = resize(760, 860);
    expect(q(el, 'mf-hero-figure')?.textContent?.trim()).toBe('On track');
    expect(el.textContent).toContain('Every milestone is on track');
  });

  it('no open modules shows the empty state', () => {
    const base = moduleForecastResponse();
    setup(
      moduleForecastResponse({ totals: { ...base.totals, modules: 0 }, items: [], projects: [] }),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No open milestones you lead with a deadline ahead.',
    );
  });

  it('the expand button opens the popup at the top', () => {
    setup();
    fixture.componentInstance.openDetail();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(fixture.componentInstance.detailSection()).toBeNull();
  });

  it('a ~270px body puts the chart title over its figure, with fewer, wider bars; ~470px keeps one line', () => {
    setup();
    // ~270px body (3 columns): the chart's title and figure on two lines, three bars at most, the short donut label.
    let el = resize(302, 900);
    const head = () => q(el, 'bar-chart-headline') as HTMLElement;
    expect(head().classList).not.toContain('bc-head--compact');
    expect(all(el, 'bar-chart-col').length).toBeLessThanOrEqual(3);
    expect(q(el, 'mf-rate')?.parentElement?.textContent).toContain('4-wk rate');
    expect(el.textContent).not.toContain('task rate · last 4 wk');
    // ~470px body: one compact line.
    el = resize(502, 900);
    expect(head().classList).toContain('bc-head--compact');
    expect(q(el, 'module-forecast-project-chart')).toBeTruthy();
  });

  it('a narrow card has no chart axis and a ranking without the rate bar', () => {
    setup();
    const el = resize(262, 900);
    expect(q(el, 'module-forecast-project-chart')).toBeTruthy();
    expect(q(el, 'bar-chart-axis')).toBeNull();
    expect(q(el, 'bar-chart-badge')).toBeNull();
    expect(q(el, 'mf-ranking')?.classList).toContain('mf-ranking--narrow');
    expect(all(el, 'bar-chart-col').length).toBeLessThanOrEqual(3);
  });
});
