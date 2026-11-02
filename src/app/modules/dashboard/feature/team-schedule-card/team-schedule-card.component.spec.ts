import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('204x204 is mini: the 140px item donut with total items and its legend', async () => {
    const { el } = await setup(response(), { width: 204, height: 204 });

    expect((q(el, 'tsc-donut') as HTMLElement).style.width).toBe('140px');
    expect(squash(q(el, 'tsc-center'))).toBe('5Totalitems');
    expect(all(el, 'tsc-legend-row').map((r) => r.getAttribute('data-key'))).toEqual([
      'completed',
      'inProgress',
      'pending',
      'meetings',
    ]);
  });

  it('420x204 is the inline mini: a stacked bar and the unscheduled-work pill', async () => {
    const { el } = await setup(response(), { width: 420, height: 204 });

    expect(q(el, 'tsc-mini-bar')).toBeTruthy();
    expect(q(el, 'tsc-donut')).toBeNull();
    expect(q(el, 'tsc-pill')!.textContent).toContain('1 employee has unscheduled work');
  });

  it('the pill says so when no one worked off-plan', async () => {
    const { el } = await setup(scheduleResponse([planned]), { width: 420, height: 204 });
    expect(q(el, 'tsc-pill')!.textContent).toContain('No unscheduled work');
  });

  it('300x636 is xs: the donut, an avatar stack, the pill, then rows', async () => {
    const { el } = await setup(response(), { width: 300, height: 636 });

    expect(q(el, 'tsc-layout')!.getAttribute('data-view')).toBe('xs');
    expect(q(el, 'tsc-donut')).toBeTruthy();
    expect(all(el, 'tsc-avatar').length).toBe(2);
    expect(q(el, 'tsc-pill')).toBeTruthy();
    expect(all(el, 'tsc-row').length).toBe(2);
  });

  it('600x420 is rows: a segmented plan bar with break and unscheduled segments, and completion', async () => {
    const withBreak = response({
      members: [{ ...planned, breaks: [{ start: at(12), end: at(12, 30) }] }, noPlan],
    });
    const { el } = await setup(withBreak, { width: 600, height: 420 });

    expect(q(el, 'tsc-layout')!.getAttribute('data-view')).toBe('rows');
    expect(all(el, 'tsc-completion').map((c) => c.textContent!.trim())).toEqual(['75%', 'No plan']);
    expect(all(el, 'tsc-plan-break').length).toBe(1);
    expect(all(el, 'tsc-plan-unscheduled').length).toBe(1);
    expect(el.textContent).toContain('Working');
  });

  it('900x636 is the timeline: labelled blocks, a hatched unscheduled strip, a conflict outline, a legend', async () => {
    const { el } = await setup(response(), { width: 900, height: 636 });

    expect(q(el, 'tsc-timeline')).toBeTruthy();
    expect(all(el, 'tsc-block').length).toBe(2);
    expect(all(el, 'tsc-unscheduled-seg').length).toBe(1);
    expect(el.querySelectorAll('.tsc-block--conflict').length).toBe(2);
    expect(all(el, 'tsc-block').map((b) => b.getAttribute('title'))).toContain('Private meeting · Finished');
    expect(all(el, 'tsc-block-label').map((l) => l.textContent!.trim())).toContain('Task');
    expect(q(el, 'tsc-legend')).toBeTruthy();
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

  it('a person without any plan gets a "No scheduled work" strip on the timeline', async () => {
    const { el } = await setup(response(), { width: 900, height: 636 });
    expect(all(el, 'tsc-no-plan').length).toBe(1);
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
    const bar = q(wide.el, 'tsc-clocked-bar') as HTMLElement;
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
