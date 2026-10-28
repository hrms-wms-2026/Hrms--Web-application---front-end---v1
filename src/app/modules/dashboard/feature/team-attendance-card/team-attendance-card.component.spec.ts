import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import { TeamAttendancePreviewRow, TeamAttendanceSummaryResponse, TeamAttendanceTrendPoint } from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
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

function summary(over: Partial<TeamAttendanceSummaryResponse> = {}): TeamAttendanceSummaryResponse {
  return {
    mode: 'week', rangeStart: '2026-10-26', rangeEnd: '2026-11-01', timezone: 'UTC', today: '2026-10-28',
    eligibleToday: 25, todayCounts: { present: 23, late: 1, absent: 1, onLeave: 0, pending: 0 }, todayRate: 96,
    periodCounts: { present: 60, late: 6, absent: 3, onLeave: 6, pending: 0 }, periodRate: 95.7, previousRate: 91.7,
    deltaPp: 4, trend: trend(),
    todayPreview: ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay'].map((n, i) => previewRow(n, i === 0 ? 'late' : i === 1 ? 'absent' : 'present')),
    departments: [], teamSize: 25, calculatedAtUtc: '2026-10-28T10:00:00Z', isProvisional: true, ...over
  };
}

describe('TeamAttendanceCardComponent', () => {
  let fixture: ComponentFixture<TeamAttendanceCardComponent>;
  let getSummary: ReturnType<typeof vi.fn>;
  let store: InstanceType<typeof TeamAttendanceStore>;

  function setup(data: TeamAttendanceSummaryResponse = summary()): void {
    getSummary = vi.fn(() => of(data));
    TestBed.configureTestingModule({
      imports: [TeamAttendanceCardComponent],
      providers: [
        TeamAttendanceStore,
        {
          provide: TeamAttendanceApiService,
          useValue: { getSummary, getEmployees: vi.fn(() => of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false })) }
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

  it('renders the small, medium or large view from one component by size', () => {
    setup();
    expect(q(resize(350, 350), 'ta-small')).toBeTruthy();
    expect(q(resize(760, 350), 'ta-medium')).toBeTruthy();
    expect(q(resize(760, 640), 'ta-large')).toBeTruthy();
    expect(getSummary).toHaveBeenCalledTimes(1);
  });

  it('a 2x2 card (or any 2-column or 2-row card) shows the mini view: rate, attended of eligible and a bare ring', () => {
    setup();
    for (const [w, h] of [[206, 204], [292, 204], [206, 420], [760, 204]]) {
      const el = resize(w, h);
      expect(q(el, 'ta-mini')).toBeTruthy();
      expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('96%');
      expect(el.textContent).toContain('24/25 in today');
      expect(q(el, 'ta-donut')).toBeTruthy();
      expect(q(el, 'ta-ring-center')).toBeNull();
    }
  });

  it('shows today\'s rate, attended of eligible and the change in points on the small view', () => {
    setup();
    const el = resize(350, 350);

    expect(q(el, 'ta-today-rate')?.textContent?.trim()).toBe('96%');
    expect(parts(q(el, 'ta-ring-center'))).toBe('24 / 25');
    expect(q(el, 'ta-delta')?.textContent?.trim()).toBe('↑ 4 pp vs last week');
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

  it('shows four status tiles and at most six preview rows on the large view, with Late named', () => {
    setup();
    const el = resize(760, 640);

    expect(el.querySelectorAll('[data-testid=kpi-tile]').length).toBe(4);
    const rows = el.querySelectorAll('[data-testid=ta-preview-row]');
    expect(rows.length).toBe(6);
    expect(rows[0].querySelector('[data-testid=ta-chip]')?.textContent?.trim()).toBe('Late');
    expect(rows[0].textContent).toContain('09:28');
  });

  it('medium view lists the four statuses with today\'s counts', () => {
    setup();
    const legend = [...resize(760, 350).querySelectorAll('[data-testid=ta-legend-row]')].map((r) => parts(r));

    expect(legend).toEqual(['Present 23 92%', 'Absent 1 4%', 'Late 1 4%', 'On leave 0 0%']);
  });

  it('an empty team shows the empty state', () => {
    setup(summary({ teamSize: 0 }));
    const el = resize(350, 350);

    expect(q(el, 'ta-small')).toBeNull();
    expect(el.textContent).toContain('No one in your team yet');
  });

  it('a period with no working days says so instead of drawing the chart', () => {
    setup(summary({ trend: trend().map((p) => ({ ...p, present: 0, late: 0, absent: 0, onLeave: 0, rate: null })) }));
    const el = resize(760, 350);

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
