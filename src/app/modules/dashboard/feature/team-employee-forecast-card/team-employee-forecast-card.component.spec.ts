import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamEmployeeForecastApiService } from '../../data-access/team-employee-forecast-api.service';
import {
  EmployeeForecastQuery,
  EmployeeForecastResponse,
} from '../../models/team-employee-forecast.model';
import { TeamEmployeeForecastStore } from '../../state/team-employee-forecast.store';
import { DASHBOARD_MINI_DONUT_PX } from '../../../../shared/ui/charts/utils/dashboard-donut.util';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { employeeForecastResponse } from '../../utils/team-employee-forecast.testing';
import { TeamEmployeeForecastCardComponent } from './team-employee-forecast-card.component';

describe('TeamEmployeeForecastCardComponent', () => {
  let fixture: ComponentFixture<TeamEmployeeForecastCardComponent>;
  let get: ReturnType<typeof vi.fn<(q: EmployeeForecastQuery) => unknown>>;

  function setup(data: EmployeeForecastResponse = employeeForecastResponse()): void {
    get = vi.fn((_q: EmployeeForecastQuery) => of(data));
    TestBed.configureTestingModule({
      imports: [TeamEmployeeForecastCardComponent],
      providers: [
        TeamEmployeeForecastStore,
        {
          provide: TeamEmployeeForecastApiService,
          useValue: { get: (q: EmployeeForecastQuery) => get(q) },
        },
      ],
    });
    fixture = TestBed.createComponent(TeamEmployeeForecastCardComponent);
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

  it('loads the top 10 people by overtime on start', () => {
    setup();
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'overtime', page: 1, pageSize: 10 }),
    );
    expect(q(fixture.nativeElement, 'team-employee-forecast-card')).toBeTruthy();
  });

  it('a 2x2 card shows the shared strip with the team rate in the donut', () => {
    setup();
    const el = resize(206, 204);
    expect(q(el, 'ef-mini')).toBeTruthy();
    expect((q(el, 'summary-strip-donut') as HTMLElement).style.width).toBe(
      `${DASHBOARD_MINI_DONUT_PX}px`,
    );
    expect(q(el, 'ef-rate')?.textContent?.trim()).toBe('40%');
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
    expect(el.textContent).toContain('People at risk');
    (el.querySelectorAll('[data-testid="summary-card"]')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailSection()).toBe('employees');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
  });

  it('a narrow tall card stacks the key and the figure under the donut', () => {
    setup();
    const el = resize(315, 420);
    expect(q(el, 'ef-layout')?.getAttribute('data-view')).toBe('xs');
    expect(all(el, 'ef-legend-row').length).toBe(3);
    expect(q(el, 'ef-hero-figure')?.textContent?.trim()).toBe('~57 h');
  });

  it('the hero reads the overtime and the rate the team needs', () => {
    setup();
    let el = resize(760, 312);
    expect(q(el, 'ef-hero-figure')?.textContent?.trim()).toBe('~57 h');
    expect(q(el, 'ef-caption')?.textContent?.trim()).toBe('Needs 55% task rate · now 40%');
    expect(q(el, 'ef-tile-overtime')?.textContent).toContain('57 h');
    // Taller, two summary cards it is not showing take the tiles' place.
    el = resize(760, 420);
    expect(q(el, 'ef-tiles')).toBeNull();
    expect(q(el, 'ef-summary-row')).toBeTruthy();
  });

  it('growing taller adds the rate chart, then the people at risk', () => {
    setup();
    let el = resize(760, 528);
    expect(q(el, 'employee-forecast-rate-chart')).toBeNull();
    el = resize(760, 636);
    expect(q(el, 'employee-forecast-rate-chart')).toBeTruthy();
    el = resize(760, 860);
    const rows = all(el, 'ef-rank-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Ann');
    // Overload first: the filled badge, with the current and required rate under the name.
    expect(rows[0].querySelector('[data-testid=ef-overload]')?.textContent?.trim()).toBe(
      '⚠ Overload',
    );
    expect(rows[0].querySelector('[data-testid=ef-row-rate]')?.textContent?.trim()).toBe(
      '38% → 130%',
    );
    expect(rows[1].querySelector('[data-testid=ef-overload]')).toBeNull();
    expect(rows[1].textContent).toContain('+');
    expect(q(el, 'ef-hero-overload')?.textContent).toContain('1 in overload');
  });

  it('nothing short: the hero says On track and the ranking says so', () => {
    const base = employeeForecastResponse();
    setup(
      employeeForecastResponse({
        totals: { ...base.totals, overtimeHours: 0, remainingHours: 0, raiseRate: 0, overload: 0 },
        items: base.items.map((m) => ({ ...m, status: 'on_track', overtimeHours: 0 })),
      }),
    );
    const el = resize(760, 860);
    expect(q(el, 'ef-hero-figure')?.textContent?.trim()).toBe('On track');
    expect(el.textContent).toContain('Everyone is on track');
  });

  it('an empty team shows the empty state', () => {
    const base = employeeForecastResponse();
    setup(employeeForecastResponse({ totals: { ...base.totals, people: 0 }, items: [] }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No one in your team yet.',
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
    expect(q(el, 'ef-rate')?.parentElement?.textContent).toContain('4-wk rate');
    expect(el.textContent).not.toContain('task rate · last 4 wk');
    // ~470px body: one compact line.
    el = resize(502, 900);
    expect(head().classList).toContain('bc-head--compact');
    expect(q(el, 'employee-forecast-rate-chart')).toBeTruthy();
  });
});
