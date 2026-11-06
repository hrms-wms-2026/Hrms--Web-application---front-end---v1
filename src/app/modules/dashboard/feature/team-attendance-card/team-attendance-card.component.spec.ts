import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import {
  TeamAttendanceEmployeeRow,
  TeamAttendancePreviewRow,
  TeamAttendanceSummaryResponse,
  TeamAttendanceTrendPoint
} from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { TeamAttendanceCardComponent } from './team-attendance-card.component';

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {
    // The card observes its host; tests report sizes through trigger().
  }
  unobserve(): void {
    // Not used by the card.
  }
  disconnect(): void {
    // Nothing to release.
  }
  trigger(width: number, height: number): void {
    this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

function trend(): TeamAttendanceTrendPoint[] {
  return ['26', '27', '28', '29', '30', '31'].map((d) => `2026-10-${d}`).concat('2026-11-01')
    .map((date) => ({ date, present: 20, late: 2, absent: 1, onLeave: 2, pending: 0, rate: 95.7 }));
}

function previewRow(name: string, bucket: TeamAttendancePreviewRow['bucket']): TeamAttendancePreviewRow {
  return { employeeId: name, name, avatarFileId: null, department: 'Dev', bucket, clockInAt: bucket === 'late' ? '2026-10-28T09:28:00Z' : null };
}

function ranked(name: string, rank: number, rate: number): TeamAttendanceEmployeeRow {
  return { employeeId: name, name, avatarFileId: null, department: 'Dev', days: [], attended: 5, eligibleDays: 5, rate, rank };
}

const RANKING = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon'].map((n, i) => ranked(n, i + 1, 100 - i * 5));

function summary(over: Partial<TeamAttendanceSummaryResponse> = {}): TeamAttendanceSummaryResponse {
  return {
    mode: 'week', rangeStart: '2026-10-26', rangeEnd: '2026-11-01', timezone: 'UTC', today: '2026-10-28',
    eligibleToday: 25, todayCounts: { present: 23, late: 1, absent: 1, onLeave: 0, pending: 0 }, todayRate: 96,
    periodCounts: { present: 60, late: 6, absent: 3, onLeave: 6, pending: 0 }, periodRate: 95.7, previousRate: 91.7,
    deltaPp: 4, trend: trend(),
    todayPreview: ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay'].map((n, i) => previewRow(n, i === 0 ? 'late' : i === 1 ? 'absent' : 'present')),
    departments: [], teamSize: 25, calculatedAtUtc: '2026-10-28T10:00:00Z', isProvisional: true, departmentRates: [], ...over
  };
}

describe('TeamAttendanceCardComponent', () => {
  let fixture: ComponentFixture<TeamAttendanceCardComponent>;
  let getSummary: ReturnType<typeof vi.fn>;
  let getEmployees: ReturnType<typeof vi.fn<(query: unknown) => unknown>>;
  let store: InstanceType<typeof TeamAttendanceStore>;

  function setup(data: TeamAttendanceSummaryResponse = summary()): void {
    getSummary = vi.fn(() => of(data));
    getEmployees = vi.fn((_query: unknown) =>
      of({ items: RANKING, pageNumber: 1, pageSize: 10, totalCount: 25, totalPages: 3, hasNext: true, hasPrevious: false })
    );
    TestBed.configureTestingModule({
      imports: [TeamAttendanceCardComponent],
      providers: [
        TeamAttendanceStore,
        {
          provide: TeamAttendanceApiService,
          useValue: { getSummary, getEmployees: (query: unknown) => getEmployees(query) }
        }
      ]
    });
    store = TestBed.inject(TeamAttendanceStore);
    fixture = TestBed.createComponent(TeamAttendanceCardComponent);
    fixture.detectChanges();
  }

  function resize(width: number, height: number): HTMLElement {
    FakeResizeObserver.instances.at(-1)!.trigger(width, height);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);
  /** The text of each child element, joined by single spaces (Angular drops the whitespace between them). */
  const parts = (el: Element | null) => [...(el?.children ?? [])].map((c) => c.textContent?.trim()).filter((t) => t).join(' ');

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('requestAnimationFrame', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('picks the mini, xs or standard view from one component by size', () => {
    setup();
    expect(q(resize(206, 204), 'ta-mini')).toBeTruthy();
    expect(q(resize(315, 420), 'ta-layout')?.getAttribute('data-view')).toBe('xs');
    expect(q(resize(760, 420), 'ta-layout')?.getAttribute('data-view')).toBe('standard');
    expect(getSummary).toHaveBeenCalledTimes(1);
  });

  it('a 2-row card shows the donut with the rate in it; stretched sideways, a stacked bar instead', () => {
    setup();
    let el = resize(206, 204);
    expect(q(el, 'ta-mini')).toBeTruthy();
    expect((q(el, 'ta-donut') as HTMLElement).style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
    expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('96%');
    expect(el.textContent).not.toContain('24/25 in today');

    el = resize(292, 204);
    expect(q(el, 'ta-donut')).toBeTruthy();
    expect(el.textContent).toContain('24/25 in today');

    el = resize(760, 204);
    expect(q(el, 'ta-mini')).toBeTruthy();
    expect(q(el, 'ta-donut')).toBeNull();
    expect(q(el, 'ta-status-bar')).toBeTruthy();
    expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('96%');
    expect(el.textContent).toContain('24/25 in today');
  });

  it('shows today\'s rate, attended of eligible and the change in points beside the donut', () => {
    setup();
    const el = resize(350, 350);

    expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('96%');
    expect(parts(q(el, 'ta-ring-center'))).toBe('24 / 25');
    expect(q(el, 'ta-delta')?.textContent?.trim()).toBe('↑ 4 pp vs last week');
  });

  it('a narrow card stacks the donut over the rate and hides the period switch and the refreshed label', () => {
    setup();
    const el = resize(315, 312);
    expect(q(el, 'ta-layout')?.getAttribute('data-view')).toBe('xs');
    expect(el.querySelector('select')).toBeNull();
    expect(q(el, 'refreshed-label')).toBeNull();
    expect(parts(q(el, 'ta-ring-center'))).toBe('24 / 25');
    expect(q(el, 'ta-delta')?.textContent?.trim()).toBe('↑ 4 pp vs last week');
  });

  it('growing taller adds the tiles, then the trend, then the ranking; the donut never changes', () => {
    setup();
    const donutWidth = () => (q(fixture.nativeElement, 'ta-donut') as HTMLElement).style.width;

    let el = resize(760, 312);
    expect(q(el, 'ta-tiles')).toBeTruthy();
    expect(q(el, 'ta-trend')).toBeNull();
    expect(donutWidth()).toBe(`${DASHBOARD_DONUT_PX}px`);

    el = resize(760, 528);
    expect(q(el, 'ta-trend')).toBeTruthy();
    expect(q(el, 'ta-ranking')).toBeNull();
    expect(getEmployees).not.toHaveBeenCalled();

    el = resize(760, 636);
    expect(q(el, 'ta-ranking')).toBeTruthy();
    expect(donutWidth()).toBe(`${DASHBOARD_DONUT_PX}px`);
    expect(getEmployees).toHaveBeenCalledWith(expect.objectContaining({ sort: 'rate', page: 1, pageSize: 10, mode: 'week' }));
  });

  it('keeps the donut one size in every view that shows it', () => {
    setup();
    for (const [w, h] of [[206, 204], [315, 312], [350, 350], [640, 350], [480, 640]]) {
      const donut = q(resize(w, h), 'ta-donut') as HTMLElement;
      expect(donut.style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
      expect(donut.style.height).toBe(`${DASHBOARD_DONUT_PX}px`);
    }
  });

  it('renders a null rate as —', () => {
    setup(summary({ todayRate: null, deltaPp: null }));
    const el = resize(350, 350);

    expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('—');
    expect(q(el, 'ta-delta')).toBeNull();
  });

  it('switching the select to Month asks the store for the month', () => {
    setup();
    const setMode = vi.spyOn(store, 'setMode');
    const select = q(resize(760, 350), 'ta-mode') as HTMLSelectElement;

    select.value = 'month';
    select.dispatchEvent(new Event('change'));

    expect(setMode).toHaveBeenCalledWith('month');
  });

  it('previous steps back, and next is disabled in the current period', () => {
    setup();
    const shift = vi.spyOn(store, 'shift');
    const el = resize(760, 350);

    (q(el, 'ta-prev') as HTMLButtonElement).click();

    expect(shift).toHaveBeenCalledWith(-1);
    expect((q(el, 'ta-next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('labels a week and a month range', () => {
    setup();
    expect(q(resize(760, 350), 'ta-range')?.textContent?.trim()).toBe('26 Oct – 1 Nov');
    TestBed.resetTestingModule();
    FakeResizeObserver.instances = [];
    setup(summary({ mode: 'month', rangeStart: '2026-10-01', rangeEnd: '2026-10-31' }));
    expect(q(resize(760, 350), 'ta-range')?.textContent?.trim()).toBe('October 2026');
  });

  it('shows four status tiles on one row on a wide card, two by two on a narrow one', () => {
    setup();
    let tiles = q(resize(760, 420), 'ta-tiles') as HTMLElement;
    expect(tiles.querySelectorAll('li').length).toBe(4);
    expect(tiles.classList).toContain('ta-tiles--4');
    expect(q(tiles, 'ta-tile-late')?.textContent).toContain('Late');

    tiles = q(resize(315, 420), 'ta-tiles') as HTMLElement;
    expect(tiles.classList).not.toContain('ta-tiles--4');
  });

  it('the ranking shows as many top employees as fit, best rate first, with the top three marked', () => {
    setup();
    let rows = [...resize(760, 636).querySelectorAll('[data-testid=ta-rank-row]')];
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Ann');
    expect(rows[0].textContent).toContain('100%');
    expect(rows[0].querySelector('.ta-rank--top')).toBeTruthy();

    rows = [...resize(760, 960).querySelectorAll('[data-testid=ta-rank-row]')];
    expect(rows.length).toBeGreaterThan(3);
    expect(getEmployees).toHaveBeenCalledTimes(1);
  });

  it('stretched sideways, the trend chart joins the donut, rate and legend in one row', () => {
    setup();
    const el = resize(1400, 312);
    const hero = q(el, 'ta-hero') as HTMLElement;

    expect(q(hero, 'ta-donut')).toBeTruthy();
    expect(q(hero, 'ta-trend')).toBeTruthy();
    expect(hero.querySelectorAll('[data-testid=ta-legend-row]').length).toBe(4);
    expect((q(el, 'ta-donut') as HTMLElement).style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
  });

  it('a wide card lists today\'s four statuses beside the donut', () => {
    setup();
    const legend = [...resize(760, 350).querySelectorAll('[data-testid=ta-legend-row]')].map((r) => parts(r));

    expect(legend).toEqual(['Present 23 92%', 'Absent 1 4%', 'Late 1 4%', 'On leave 0 0%']);
  });

  it('an empty team shows the empty state', () => {
    setup(summary({ teamSize: 0 }));
    const el = resize(350, 350);

    expect(q(el, 'ta-layout')).toBeNull();
    expect(el.textContent).toContain('No one in your team yet');
  });

  it('a period with no working days says so instead of drawing the chart', () => {
    setup(summary({ trend: trend().map((p) => ({ ...p, present: 0, late: 0, absent: 0, onLeave: 0, rate: null })) }));
    const el = resize(760, 528);

    expect(q(el, 'ta-no-days')).toBeTruthy();
    expect(el.querySelector('app-attendance-day-chart')).toBeNull();
  });

  it('View all opens the detail dialog, which closes back to the card', () => {
    setup();
    const el = resize(760, 640);

    (q(el, 'ta-view-all') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(document.body.querySelector('[data-testid=tad-controls]')).toBeTruthy();

    fixture.componentInstance.closeDetail();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(false);
  });
});
