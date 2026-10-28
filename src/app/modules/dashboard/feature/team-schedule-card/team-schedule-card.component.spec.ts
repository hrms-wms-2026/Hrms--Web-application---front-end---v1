import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../../data-access/team-schedule-api.service';
import { TeamScheduleResponse } from '../../models/team-schedule.model';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { at, scheduleMember, scheduleResponse } from '../../utils/team-schedule.testing';
import { TeamScheduleCardComponent } from './team-schedule-card.component';

const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

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
    { kind: 'task', taskId: 't1', title: 'Write report', start: at(9), end: at(10), status: 'completed', isPrivate: false },
    { kind: 'meeting', taskId: 'm1', title: 'Private meeting', start: at(9, 30), end: at(11), status: 'finished', isPrivate: true }
  ],
  conflicts: [{ kind: 'block_meeting', start: at(9, 30), end: at(10), firstTitle: 'Write report', secondTitle: 'Private meeting' }]
});
const noPlan = scheduleMember({
  displayName: 'Bob',
  clockedMinutes: 120,
  noPlanMinutes: 120,
  unscheduled: [{ taskId: 't2', title: 'Fix bug', start: at(13), end: at(15), minutes: 120, kind: 'no_plan' }]
});

function response(overrides: Partial<TeamScheduleResponse> = {}): TeamScheduleResponse {
  return scheduleResponse([planned, noPlan], {
    summary: { people: 2, tasksPlanned: 4, tasksCompleted: 1, tasksInProgress: 1, tasksPending: 2, meetings: 1, peopleWithUnscheduledWork: 1, unscheduledMinutes: 120, conflicts: 1 },
    ...overrides
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
    size: { width: number; height: number } | null = null
  ): Promise<{ fixture: ComponentFixture<TeamScheduleCardComponent>; el: HTMLElement; getTeamDay: ReturnType<typeof vi.fn> }> {
    stubResizeObserver();
    const getTeamDay = vi.fn(() => (result === 'error' ? throwError(() => new Error('x')) : of(result)));
    await TestBed.configureTestingModule({
      imports: [TeamScheduleCardComponent],
      providers: [TeamScheduleStore, { provide: TeamScheduleApiService, useValue: { getTeamDay } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(TeamScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    if (size) FakeResizeObserver.instances[0].trigger(size.width, size.height);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, getTeamDay };
  }

  it('loads today and is titled "Today\'s team schedule"', async () => {
    const { el, getTeamDay } = await setup();

    expect(getTeamDay).toHaveBeenCalledWith(null);
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

  it('2x2 is the mini view: the task donut at 140px and the unscheduled-work alert', async () => {
    const { el } = await setup(response(), { width: cols(2), height: rows(2) });

    expect((el.querySelector('[data-testid="tsc-donut"]') as HTMLElement).style.width).toBe('140px');
    expect(el.querySelector('[data-testid="tsc-center"]')!.textContent!.replace(/\s+/g, '')).toBe('1/4tasks');
    expect(el.querySelector('[data-testid="tsc-unscheduled-alert"]')!.textContent).toContain('1 person has');
  });

  it('hides the alert when no one worked off-plan', async () => {
    const { el } = await setup(scheduleResponse([planned]), { width: cols(2), height: rows(2) });
    expect(el.querySelector('[data-testid="tsc-unscheduled-alert"]')).toBeNull();
  });

  it('medium shows "No plan" for a no-plan worker with the amber unscheduled badge, and completion for the planned one', async () => {
    const { el } = await setup(response(), { width: cols(4), height: rows(4) });

    const completion = [...el.querySelectorAll('[data-testid="tsc-completion"]')].map((c) => c.textContent!.trim());
    expect(completion).toEqual(['75%', 'No plan']);
    expect(el.querySelector('[data-testid="tsc-unscheduled"]')!.textContent).toContain('Unscheduled 2h');
    expect(el.textContent).toContain('Working');
  });

  it('large draws the timeline: blocks, a striped unscheduled segment and a conflict outline', async () => {
    const { el } = await setup(response(), { width: cols(8), height: rows(6) });

    expect(el.querySelector('[data-testid="tsc-timeline"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="tsc-block"]').length).toBe(2);
    expect(el.querySelectorAll('[data-testid="tsc-unscheduled-seg"]').length).toBe(1);
    expect(el.querySelectorAll('.tsc-block--conflict').length).toBe(2);
    const titles = [...el.querySelectorAll('[data-testid="tsc-block"]')].map((b) => b.getAttribute('title'));
    expect(titles).toContain('Private meeting · Finished');
  });

  it('Planner off: the note replaces plan bars and the timeline, clocked time still listed', async () => {
    const off = response({ plannerEnabled: false });
    const medium = await setup(off, { width: cols(4), height: rows(4) });
    expect(medium.el.querySelector('[data-testid="tsc-planner-off"]')).toBeTruthy();
    expect(medium.el.querySelector('.tsc-plan-bar')).toBeNull();
    expect(medium.el.textContent).toContain('2h clocked');
    TestBed.resetTestingModule();

    const large = await setup(off, { width: cols(8), height: rows(6) });
    expect(large.el.querySelector('[data-testid="tsc-timeline"]')).toBeNull();
    expect(large.el.querySelector('[data-testid="tsc-planner-off"]')).toBeTruthy();
    TestBed.resetTestingModule();

    const mini = await setup(off, { width: cols(2), height: rows(2) });
    expect(mini.el.querySelector('[data-testid="tsc-donut"]')).toBeNull();
    expect(mini.el.querySelector('[data-testid="tsc-planner-off"]')).toBeTruthy();
  });

  it('a poll tick keeps the row order (ranking re-sorts only when the data changes)', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { fixture, el } = await setup(response(), { width: cols(4), height: rows(4) });
    const before = [...el.querySelectorAll('[data-testid="tsc-row"] .tsc-name')].map((n) => n.textContent);

    await vi.advanceTimersByTimeAsync(60_000);
    fixture.detectChanges();

    expect([...el.querySelectorAll('[data-testid="tsc-row"] .tsc-name')].map((n) => n.textContent)).toEqual(before);
  });
});
