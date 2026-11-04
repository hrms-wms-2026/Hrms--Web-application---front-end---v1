import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayMember, TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { presenceMember, presenceResponse } from '../../utils/team-presence.testing';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { TeamStatusCardComponent } from './team-status-card.component';


const TEAM = [
  presenceMember('working', {
    displayName: 'Ada',
    clockInAt: '2026-10-29T03:30:00Z',
    stateSince: '2026-10-29T03:30:00Z',
    shiftEndsAt: '2026-10-29T12:00:00Z',
    attendanceMinutes: 360,
    expectedMinutes: 480,
    isLate: true,
  }),
  presenceMember('on_break', {
    displayName: 'Bob',
    stateSince: '2026-10-29T09:50:00Z',
    breakRemainingMinutes: null,
    attendanceMinutes: 120,
    breaks: [{ start: '2026-10-29T08:00:00Z', end: '2026-10-29T08:15:00Z' }],
  }),
  presenceMember('on_leave', {
    displayName: 'Cat',
    expectedMinutes: 0,
    leaveMinutes: 480,
    leave: { leaveTypeName: 'Annual Leave', endsOn: '2026-10-30' },
  }),
  presenceMember('absent', { displayName: 'Dan' }),
  presenceMember('not_started', { displayName: 'Eve' }),
  presenceMember('clocked_out', { displayName: 'Fay' }),
];

function crowd(n: number): TeamTodayMember[] {
  return Array.from({ length: n }, (_, i) =>
    presenceMember('working', { displayName: `P${String(i).padStart(2, '0')}`, employeeId: `p-${i}` }),
  );
}

const WEEK = {
  weekStart: '2026-10-26',
  weekEnd: '2026-11-01',
  days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((date) => ({
    date,
    workedMinutes: 600,
    breakMinutes: 60,
    onLeaveCount: 0,
    peopleWithRecord: 2,
  })),
};

describe('TeamStatusCardComponent (Working / Break / Leave)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function setup(
    result: TeamTodayResponse | 'error' = presenceResponse(TEAM),
    size: { width: number; height: number } | null = null,
    extraProviders: unknown[] = [],
  ): Promise<{
    fixture: ComponentFixture<TeamStatusCardComponent>;
    getTeamToday: ReturnType<typeof vi.fn>;
    getWeek: ReturnType<typeof vi.fn>;
    el: HTMLElement;
  }> {
    stubResizeObserver();
    const getTeamToday = vi.fn(() => (result === 'error' ? throwError(() => new Error('network error')) : of(result)));
    const getWeek = vi.fn(() => of(WEEK));
    await TestBed.configureTestingModule({
      imports: [TeamStatusCardComponent],
      providers: [
        MyTeamTodayStore,
        { provide: MyTeamTodayApiService, useValue: { getTeamToday } },
        { provide: TeamWorkingHoursApiService, useValue: { getWeek } },
        ...(extraProviders as never[]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TeamStatusCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    if (size) FakeResizeObserver.instances[0].trigger(size.width, size.height);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getTeamToday, getWeek, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, testId: string) =>
    el.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const has = (el: HTMLElement, testId: string) => !!el.querySelector(`[data-testid="${testId}"]`);
  const all = (el: HTMLElement, testId: string) => [...el.querySelectorAll(`[data-testid="${testId}"]`)];

  it('loads on init and is titled Working / Break / Leave', async () => {
    const { el, getTeamToday } = await setup();

    expect(getTeamToday).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Working / Break / Leave');
  });

  it('shows the error state when loading fails', async () => {
    const { el } = await setup('error');
    expect(el.textContent).toContain("Couldn't load who is working");
  });

  it('shows the empty state for an empty team', async () => {
    const { el } = await setup(presenceResponse([]));
    expect(el.textContent).toContain('No one in your team to show.');
  });

  it('204x204 is mini: the 140px donut with the team total working hours, its legend in hours', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 204, height: 204 });

    expect(has(el, 'wbl-mini')).toBe(true);
    expect((el.querySelector('[data-testid="wbl-donut"]') as HTMLElement).style.width).toBe('140px');
    // Ada 6h + Bob 2h worked; Bob's closed 15m break; Cat's 8h leave.
    expect(text(el, 'wbl-center')!.replace(/\s+/g, '')).toBe('8hWorkinghours');
    expect(text(el, 'wbl-count-working')).toContain('8h');
    expect(text(el, 'wbl-count-break')).toContain('15m');
    expect(text(el, 'wbl-count-leave')).toContain('8h');
  });

  it('a masked leave adds no leave hours', async () => {
    const { el } = await setup(presenceResponse([presenceMember('absent', { leaveMinutes: 0 }), presenceMember('working', { attendanceMinutes: 60 })]), {
      width: 204,
      height: 204,
    });
    expect(text(el, 'wbl-count-leave')).toContain('0m');
  });

  it('420x204 is the inline mini: a stacked bar, the legend and the status pill', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 420, height: 204 });

    expect(has(el, 'wbl-mini-bar')).toBe(true);
    expect(has(el, 'wbl-donut')).toBe(false);
    expect(text(el, 'wbl-pill')).toContain('1 employee is currently working');
  });

  it('300x636 is xs: the donut over its legend, the pill, then person rows', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 300, height: 636 });

    expect(el.querySelector('[data-testid="wbl-layout"]')!.getAttribute('data-view')).toBe('xs');
    expect(has(el, 'wbl-donut')).toBe(true);
    expect(has(el, 'wbl-legend')).toBe(true);
    expect(has(el, 'wbl-pill')).toBe(true);
    expect(has(el, 'wbl-tiles')).toBe(false);
    // Under the donut: each employee's working hours, most worked first, with break and leave in the same bar.
    const rows = all(el, 'wbl-hours-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].querySelector('.wbl-name')!.textContent!.trim()).toBe('Ada');
    expect(rows[0].querySelector('[data-testid="wbl-hours-total"]')!.textContent!.trim()).toBe('6h');
    const bob = rows.find((r) => r.querySelector('.wbl-name')!.textContent!.trim() === 'Bob')!;
    expect(bob.querySelector('[data-segment="break"]')).not.toBeNull();
    const cat = rows.find((r) => r.querySelector('.wbl-name')!.textContent!.trim() === 'Cat')!;
    expect(cat.querySelector('[data-testid="wbl-hours-total"]')!.textContent!.trim()).toBe('Leave 8h');
  });

  it('600x420 is standard: tiles with % of team, then person rows in working-break-leave order', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 600, height: 420 });

    expect(el.querySelector('[data-testid="wbl-layout"]')!.getAttribute('data-view')).toBe('standard');
    expect(text(el, 'wbl-tile-working')).toContain('1');
    expect(text(el, 'wbl-tile-working')).toContain('17%');
    expect(text(el, 'wbl-tile-leave')).toContain('On leave');
    const names = all(el, 'wbl-row').map((r) => r.querySelector('.wbl-name')!.textContent!.trim());
    expect(names.slice(0, 3)).toEqual(['Ada', 'Bob', 'Cat']);
    expect(has(el, 'wbl-table')).toBe(false);
  });

  it('a row shows the start time, the time left in the state colour and today hours progress', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T09:30:00Z'));
    const { el } = await setup(presenceResponse(TEAM), { width: 600, height: 420 });

    const ada = all(el, 'wbl-row')[0];
    expect(ada.querySelector('[data-testid="wbl-left"]')!.textContent!.trim()).toBe('2h 30m left');
    expect(ada.querySelector('[data-testid="wbl-progress"]')!.textContent!.trim()).toBe('75%');
    // Bob's break has no allowance: no time left, no guessed bar.
    expect(all(el, 'wbl-row')[1].querySelector('[data-testid="wbl-left"]')).toBeNull();
    expect(all(el, 'wbl-row')[1].querySelector('[data-testid="wbl-progress"]')!.textContent!.trim()).toBe('—');
  });

  it('a masked leave (absent) is never counted under Leave', async () => {
    const { el } = await setup(presenceResponse([presenceMember('absent'), presenceMember('working')]), {
      width: 600,
      height: 420,
    });

    expect(text(el, 'wbl-tile-leave')).toContain('0');
  });

  it('900x636 is a table with every column and "—" for a remaining time without a denominator', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 900, height: 636 });

    expect(has(el, 'wbl-table')).toBe(true);
    const heads = [...el.querySelectorAll('[data-testid="wbl-table"] th')].map((th) => th.textContent!.trim());
    expect(heads).toEqual(['#', 'Employee', 'Status', 'Start', 'Elapsed', 'Remaining', 'Today hours', 'Progress']);
    const remaining = all(el, 'wbl-remaining').map((c) => c.textContent!.trim());
    expect(remaining[1]).toBe('—');
    expect(remaining[2]).toBe('—');
    expect(all(el, 'wbl-today-hours')[0].textContent!.trim()).toBe('6h / 8h');
  });

  it('1300x852 adds the week trend under the table and loads it once', async () => {
    const { el, getWeek } = await setup(presenceResponse(TEAM), { width: 1300, height: 852 });

    expect(has(el, 'wbl-table')).toBe(true);
    expect(has(el, 'wbl-trend')).toBe(true);
    expect(getWeek).toHaveBeenCalledOnce();
    expect(has(el, 'working-hours-chart')).toBe(true);
  });

  it('a smaller card never loads the trend', async () => {
    const { getWeek } = await setup(presenceResponse(TEAM), { width: 600, height: 420 });
    expect(getWeek).not.toHaveBeenCalled();
  });

  it('60 members at 600x420 show the rows that fit and "View all 60 ›"', async () => {
    const { el } = await setup(presenceResponse(crowd(60)), { width: 600, height: 420 });

    const shown = all(el, 'wbl-row').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(60);
    expect(text(el, 'wbl-view-all')).toBe('View all 60 ›');
  });

  it('no "View all" when everyone fits', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: 1300, height: 852 });
    expect(has(el, 'wbl-view-all')).toBe(false);
  });

  it('the card body never scrolls: no element inside is a scroll container', async () => {
    const { el } = await setup(presenceResponse(crowd(60)), { width: 900, height: 636 });

    const scrollers = [...el.querySelectorAll<HTMLElement>('*')].filter((node) => {
      const style = getComputedStyle(node);
      return ['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflow);
    });
    expect(scrollers).toEqual([]);
    expect(getComputedStyle(el.querySelector('[data-testid="wbl-layout"]')!).overflow).toBe('hidden');
  });

  it('opens the popup from the pill', async () => {
    const { fixture, el } = await setup(presenceResponse(TEAM), { width: 300, height: 636 });

    (el.querySelector('[data-testid="wbl-pill"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
  });

  it('does not poll on a timer, and reloads when the tab becomes visible again', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { getTeamToday } = await setup();

    await vi.advanceTimersByTimeAsync(180_000);
    expect(getTeamToday).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(getTeamToday).toHaveBeenCalledTimes(2);
  });

  it('a clock tick changes elapsed times but not the counts or the order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true });
    const { fixture, el, getTeamToday } = await setup(presenceResponse(TEAM), { width: 900, height: 636 });
    const names = () => all(el, 'wbl-table-row').map((r) => r.querySelector('.wbl-name')!.textContent);
    const before = names();

    await vi.advanceTimersByTimeAsync(30_000);
    fixture.detectChanges();

    expect(names()).toEqual(before);
    expect(getTeamToday).toHaveBeenCalledOnce();
  });

  it('inside a dashboard frame it uses the bootstrap payload without calling its api', async () => {
    const payload = presenceResponse(TEAM);
    const widget = fakeWidgetData('success', payload);
    const { getTeamToday } = await setup(presenceResponse([]), null, [widget.provider]);

    expect(getTeamToday).not.toHaveBeenCalled();
    expect(TestBed.inject(MyTeamTodayStore).data()).toEqual(payload);
  });
});
