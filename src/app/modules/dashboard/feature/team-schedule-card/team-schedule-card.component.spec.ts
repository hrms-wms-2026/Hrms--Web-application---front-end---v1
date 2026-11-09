import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../../data-access/team-schedule-api.service';
import { TeamScheduleResponse } from '../../models/team-schedule.model';
import { TeamScheduleWeekStore } from '../../state/team-schedule-week.store';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { at, scheduleMember, scheduleResponse, weekResponse } from '../../utils/team-schedule.testing';
import { TeamScheduleCardComponent } from './team-schedule-card.component';

const planned = scheduleMember({
  displayName: 'Ada',
  rank: 1,
  score: 75,
  itemCompletionPercent: 75,
  timeCoveragePercent: 75,
  notRankedReason: 'none',
  plannedTaskMinutes: 120,
  presenceStatus: 'working',
  items: [
    {
      kind: 'task',
      taskId: 't1',
      title: 'Write report',
      start: at(9),
      end: at(10),
      status: 'completed',
      isPrivate: false,
    },
    {
      kind: 'meeting',
      taskId: 'm1',
      title: 'Private meeting',
      start: at(9, 30),
      end: at(11),
      status: 'finished',
      isPrivate: true,
    },
  ],
  conflicts: [
    {
      kind: 'block_meeting',
      start: at(9, 30),
      end: at(10),
      firstTitle: 'Write report',
      secondTitle: 'Private meeting',
    },
  ],
});
const noPlan = scheduleMember({
  displayName: 'Bob',
  clockedMinutes: 120,
  noPlanMinutes: 120,
  unscheduled: [
    { taskId: 't2', title: 'Fix bug', start: at(13), end: at(15), minutes: 120, kind: 'no_plan' },
  ],
});

function response(overrides: Partial<TeamScheduleResponse> = {}): TeamScheduleResponse {
  return scheduleResponse([planned, noPlan], {
    summary: {
      people: 2,
      tasksPlanned: 4,
      tasksCompleted: 1,
      tasksInProgress: 1,
      tasksPending: 2,
      meetings: 1,
      peopleWithUnscheduledWork: 1,
      unscheduledMinutes: 120,
      conflicts: 1,
    },
    ...overrides,
  });
}

describe('TeamScheduleCardComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function setup(
    result: TeamScheduleResponse | 'error' = response(),
    size: { width: number; height: number } | null = null,
  ): Promise<{
    fixture: ComponentFixture<TeamScheduleCardComponent>;
    el: HTMLElement;
    getTeamDay: ReturnType<typeof vi.fn>;
    getTeamWeek: ReturnType<typeof vi.fn>;
  }> {
    stubResizeObserver();
    const getTeamDay = vi.fn(() =>
      result === 'error' ? throwError(() => new Error('x')) : of(result),
    );
    const getTeamWeek = vi.fn(() => of(weekResponse()));
    await TestBed.configureTestingModule({
      imports: [TeamScheduleCardComponent],
      providers: [
        provideRouter([]),
        TeamScheduleStore,
        TeamScheduleWeekStore,
        { provide: TeamScheduleApiService, useValue: { getTeamDay, getTeamWeek } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TeamScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    if (size) FakeResizeObserver.instances[0].trigger(size.width, size.height);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, getTeamDay, getTeamWeek };
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
  const all = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];
  const squash = (node: Element | null) => node?.textContent?.replace(/\s+/g, '') ?? null;

  it('loads today and is titled "Today\'s team schedule"', async () => {
    const { el, getTeamDay, getTeamWeek } = await setup();

    expect(getTeamDay).toHaveBeenCalledWith(null);
    expect(getTeamWeek).not.toHaveBeenCalled();
    expect(el.textContent).toContain("Today's team schedule");
  });

  it('shows "No one reports to you" when there are no members', async () => {
    const { el } = await setup(scheduleResponse([]));
    expect(el.textContent).toContain('No one reports to you');
  });

  it('shows the error state when loading fails', async () => {
    const { el } = await setup('error');
    expect(el.textContent).toContain("Couldn't load the team's schedule.");
  });

  /** Reports the 2-row strip's size for a widget host width (the strip fills the body: host minus 32px). */
  function stripResize(fixture: ComponentFixture<TeamScheduleCardComponent>, hostWidth: number): void {
    FakeResizeObserver.instances.at(-1)!.trigger(hostWidth - 32, 150);
    fixture.detectChanges();
  }

  it('204x204 is mini: the shared strip with the item donut and the count in it, no stacked bar', async () => {
    const { el } = await setup(response(), { width: 204, height: 204 });

    expect(q(el, 'tsc-mini')).toBeTruthy();
    expect(q(el, 'summary-strip-donut')).toBeTruthy();
    expect(q(el, 'tsc-mini-count')!.textContent!.trim()).toBe('5');
    expect(q(el, 'tsc-mini-bar')).toBeNull();
    // The planner link lives only in the popup now.
    expect(q(el, 'tsc-open-planner')).toBeNull();
  });

  it('a wide 2-row card adds the key and four summary cards, loading the week once the first card shows', async () => {
    const { el, fixture, getTeamWeek } = await setup(response(), { width: 1812, height: 204 });
    expect(getTeamWeek).not.toHaveBeenCalled();
    stripResize(fixture, 1812);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('app-donut-key')).toBeTruthy();
    expect(el.querySelectorAll('app-dashboard-summary-card').length).toBe(4);
    expect(getTeamWeek).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Needs a plan');
    stripResize(fixture, 1700);
    expect(getTeamWeek).toHaveBeenCalledOnce();
  });

  it('browsing to another week in the popup leaves the coverage card on the current week', async () => {
    const { el, fixture, getTeamWeek } = await setup(response(), { width: 1812, height: 204 });
    getTeamWeek.mockImplementation((start: string | null) =>
      of(start ? weekResponse({ weekStart: start, totals: { plannedMinutes: 60, clockedMinutes: 0, scheduledMinutes: 6, unscheduledMinutes: 0, coveragePercent: 10 } }) : weekResponse({ totals: { plannedMinutes: 600, clockedMinutes: 0, scheduledMinutes: 480, unscheduledMinutes: 0, coveragePercent: 80 } })),
    );
    stripResize(fixture, 1812);
    expect(el.textContent).toContain('80%');
    TestBed.inject(TeamScheduleWeekStore).shiftWeek(-1);
    fixture.detectChanges();
    expect(getTeamWeek).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('80%');
    expect(el.textContent).not.toContain('10%');
  });

  it('a failed week shows the week cards as failed', async () => {
    const { el, fixture, getTeamWeek } = await setup(response(), { width: 1812, height: 204 });
    getTeamWeek.mockImplementation(() => throwError(() => new Error('down')));
    stripResize(fixture, 1812);
    expect(el.querySelectorAll('[data-testid="summary-retry"]').length).toBe(2);
  });

  it('a summary card opens the popup at its section', async () => {
    const { el, fixture } = await setup(response(), { width: 1812, height: 204 });
    stripResize(fixture, 1812);
    (el.querySelectorAll('[data-testid="summary-card"]')[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(fixture.componentInstance.detailSection()).toBe('status');
  });

  it('the chips count over capacity and on leave over everyone', async () => {
    const busy = { ...planned, plannedTaskMinutes: 540, expectedMinutes: 480 };
    const away = { ...noPlan, presenceStatus: 'on_leave', notRankedReason: 'on_leave' as const };
    const { el } = await setup(response({ members: [busy, away] }), { width: 300, height: 636 });
    expect(all(el, 'tsc-chip').map((c) => c.textContent!.trim())).toEqual([
      '1 over capacity',
      '0 not planned',
      '1 on leave',
    ]);
  });

  it('300x636 is xs: the 168px item donut over its legend, the chips, then rows', async () => {
    const { el } = await setup(response(), { width: 300, height: 636 });

    expect(q(el, 'tsc-layout')!.getAttribute('data-view')).toBe('xs');
    expect((q(el, 'tsc-donut') as HTMLElement).style.width).toBe('168px');
    expect(squash(q(el, 'tsc-center'))).toBe('5items');
    expect(all(el, 'tsc-legend-row').map((r) => r.getAttribute('data-key'))).toEqual([
      'completed',
      'inProgress',
      'pending',
      'meetings',
    ]);
    expect(q(el, 'tsc-chips')).toBeTruthy();
    expect(all(el, 'tsc-row').length).toBe(2);
  });

  it('600x420 is rows: load against capacity with its bar, a Not planned badge, and done', async () => {
    const { el } = await setup(response(), { width: 600, height: 420 });

    expect(q(el, 'tsc-layout')!.getAttribute('data-view')).toBe('rows');
    expect(all(el, 'tsc-load').map((c) => c.textContent!.trim())).toEqual(['2h / 8h', '0h / 8h']);
    expect((all(el, 'tsc-load-bar')[0] as HTMLElement).style.width).toBe('25%');
    expect(q(el, 'tsc-badge-not-planned')).toBeTruthy();
    expect(all(el, 'tsc-completion').map((c) => c.textContent!.trim())).toEqual(['75%', '—']);
  });

  it('900x636 is the timeline: the donut head, titled blocks, a hatched unscheduled strip, a conflict outline, a legend', async () => {
    const { el } = await setup(response(), { width: 900, height: 636 });

    expect(q(el, 'tsc-head')).toBeTruthy();
    expect(squash(q(el, 'tsc-center'))).toBe('5Totalitems');
    expect(q(el, 'tsc-timeline')).toBeTruthy();
    expect(all(el, 'tsc-block').length).toBe(2);
    expect(all(el, 'tsc-unscheduled-seg').length).toBe(1);
    expect(el.querySelectorAll('.tsc-block--conflict').length).toBe(2);
    expect(all(el, 'tsc-block').map((b) => b.getAttribute('title'))).toContain('Private meeting · Finished');
    expect(all(el, 'tsc-block-label').map((l) => l.textContent!.trim())).toContain('Write report');
    expect(q(el, 'tsc-legend')).toBeTruthy();
    expect(q(el, 'tsc-view-all')!.textContent).toContain('View all 2 members');
  });

  it('block label hidden under 48px', async () => {
    const short = response({
      members: [
        {
          ...planned,
          items: [
            { kind: 'task', taskId: 't1', title: 'Long', start: at(9), end: at(12), status: 'pending', isPrivate: false },
            { kind: 'meeting', taskId: 'm1', title: 'Quick', start: at(13), end: at(13, 15), status: 'upcoming', isPrivate: false },
          ],
          conflicts: [],
        },
      ],
    });
    const { el } = await setup(short, { width: 900, height: 636 });

    const blocks = all(el, 'tsc-block');
    expect(blocks[0].querySelector('[data-testid="tsc-block-label"]')).toBeTruthy();
    expect(blocks[1].querySelector('[data-testid="tsc-block-label"]')).toBeNull();
  });

  it('on the timeline a person without a plan gets a Not planned badge, and one on leave a leave strip', async () => {
    const away = { ...planned, employeeId: 'c', displayName: 'Cy', presenceStatus: 'on_leave', notRankedReason: 'on_leave' as const, items: [], conflicts: [] };
    const { el } = await setup(response({ members: [planned, noPlan, away] }), { width: 900, height: 636 });
    expect(all(el, 'tsc-badge-not-planned').length).toBe(1);
    expect(all(el, 'tsc-badge-leave').length).toBe(1);
    expect(all(el, 'tsc-leave-bar').length).toBe(1);
  });

  it('the timeline head swaps its status chips for two summary cards of what the card is not showing', async () => {
    const { el, fixture, getTeamWeek } = await setup(response(), { width: 900, height: 636 });
    await fixture.whenStable();
    fixture.detectChanges();
    const head = q(el, 'tsc-head')!;
    const titles = [...head.querySelectorAll('[data-testid="summary-title"]')].map((t) => t.textContent?.trim());
    // The lines already show each person's status and Not planned badge, so those cards are left out.
    expect(titles).toEqual(['Coverage', 'Planned vs actual']);
    expect(head.querySelector('[data-testid="tsc-chip"]')).toBeNull();
    expect(getTeamWeek).toHaveBeenCalledOnce();
  });

  it('keeps the head chips when the week chart leaves only one new card', async () => {
    const { el } = await setup(response(), { width: 1300, height: 852 });
    const head = q(el, 'tsc-head')!;
    expect(head.querySelector('app-dashboard-summary-row')).toBeNull();
    expect(head.querySelector('[data-testid="tsc-chip"]')).toBeTruthy();
  });

  it('900x852 adds the daily planned-vs-actual chart with a row per shown person', async () => {
    const { el } = await setup(response(), { width: 900, height: 852 });

    expect(q(el, 'tsc-day-chart')).toBeTruthy();
    expect(all(el, 'pad-row').length).toBe(2);
    expect(q(el, 'tsc-week-chart')).toBeNull();
  });

  it('week chart only at 1300x852 and loads the week store once', async () => {
    const { el, fixture, getTeamWeek } = await setup(response(), { width: 1300, height: 852 });

    expect(q(el, 'tsc-week-chart')).toBeTruthy();
    expect(q(el, 'tsc-side')).toBeTruthy();
    expect(getTeamWeek).toHaveBeenCalledOnce();

    FakeResizeObserver.instances[0].trigger(1310, 860);
    fixture.detectChanges();
    expect(getTeamWeek).toHaveBeenCalledOnce();
  });

  it('planner off shows clocked vs expected and no timeline', async () => {
    const off = response({
      plannerEnabled: false,
      members: [{ ...noPlan, clockedMinutes: 240, expectedMinutes: 480 }],
    });
    const wide = await setup(off, { width: 900, height: 636 });
    expect(q(wide.el, 'tsc-timeline')).toBeNull();
    expect(q(wide.el, 'tsc-planner-off')).toBeTruthy();
    expect(q(wide.el, 'tsc-day-chart')).toBeNull();
    const bar = q(wide.el, 'tsc-load-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
    expect(wide.el.textContent).toContain('4h / 8h');
    TestBed.resetTestingModule();

    const mini = await setup(off, { width: 204, height: 204 });
    expect(q(mini.el, 'tsc-donut')).toBeNull();
    expect(squash(q(mini.el, 'tsc-clocked-total'))).toContain('4h');
    expect(q(mini.el, 'tsc-planner-off')).toBeTruthy();
  });

  it('no scroll container inside the card', async () => {
    const many = response({
      members: Array.from({ length: 40 }, (_, i) => ({ ...noPlan, employeeId: `e${i}`, displayName: `P${i}` })),
    });
    const { el } = await setup(many, { width: 900, height: 636 });

    const scrollers = [...el.querySelectorAll<HTMLElement>('*')].filter((node) => {
      const style = getComputedStyle(node);
      return ['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflow);
    });
    expect(scrollers).toEqual([]);
    expect(getComputedStyle(q(el, 'tsc-layout')!).overflow).toBe('hidden');
    expect(q(el, 'tsc-view-all')!.textContent).toContain('View all 40');
  });

  it('a poll tick keeps the row order (ranking re-sorts only when the data changes)', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    const { fixture, el } = await setup(response(), { width: 600, height: 420 });
    const names = () => all(el, 'tsc-row').map((r) => r.querySelector('.tsc-name')!.textContent);
    const before = names();

    await vi.advanceTimersByTimeAsync(60_000);
    fixture.detectChanges();

    expect(names()).toEqual(before);
  });
});
