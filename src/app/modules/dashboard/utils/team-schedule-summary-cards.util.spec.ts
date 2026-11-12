import { describe, expect, it } from 'vitest';
import { SummaryCardBody, SummaryCardModel } from '../models/summary-card.model';
import { TeamScheduleMember, TeamScheduleResponse, TeamScheduleWeekResponse } from '../models/team-schedule.model';
import { teamScheduleSummaryCards } from './team-schedule-summary-cards.util';

function member(name: string, over: Partial<TeamScheduleMember> = {}): TeamScheduleMember {
  return {
    employeeId: name,
    displayName: name,
    avatarFileId: null,
    timezone: 'UTC',
    presenceStatus: 'working',
    plannedTaskMinutes: 240,
    plannedMeetingMinutes: 0,
    clockedMinutes: 0,
    scheduledMinutes: 0,
    outsideSlotMinutes: 0,
    noPlanMinutes: 0,
    itemCompletionPercent: null,
    timeCoveragePercent: null,
    score: null,
    notRankedReason: 'none',
    rank: null,
    items: [{ kind: 'task', taskId: 't', title: 'T', start: '', end: '', status: 'pending', isPrivate: false }],
    unscheduled: [],
    conflicts: [],
    expectedMinutes: 480,
    breaks: [],
    ...over
  };
}

const noPlan = { plannedTaskMinutes: 0, items: [], notRankedReason: 'no_planned_task_time' as const };

function day(members: TeamScheduleMember[], plannerEnabled = true): TeamScheduleResponse {
  return {
    date: '2026-11-07',
    plannerEnabled,
    asOf: '2026-11-07T10:00:00Z',
    summary: { people: members.length, tasksPlanned: 0, tasksCompleted: 0, tasksInProgress: 0, tasksPending: 0, meetings: 0, peopleWithUnscheduledWork: 0, unscheduledMinutes: 0, conflicts: 0 },
    members
  };
}

const totals = (planned: number, clocked: number, scheduled: number, coverage: number | null) => ({
  plannedMinutes: planned,
  clockedMinutes: clocked,
  scheduledMinutes: scheduled,
  unscheduledMinutes: 0,
  coveragePercent: coverage
});

function week(plannerEnabled = true): TeamScheduleWeekResponse {
  const d = (date: string, task: number, meeting: number, clocked: number) => ({
    date,
    plannedTaskMinutes: task,
    plannedMeetingMinutes: meeting,
    clockedMinutes: clocked,
    scheduledMinutes: 0,
    outsideSlotMinutes: 0,
    noPlanMinutes: 0
  });
  return {
    weekStart: '2026-11-02',
    weekEnd: '2026-11-08',
    plannerEnabled,
    asOf: '2026-11-07T10:00:00Z',
    days: [d('2026-11-02', 420, 60, 420), d('2026-11-03', 480, 0, 360)],
    totals: totals(12000, 9000, 9360, 78),
    previous: totals(11000, 8000, 7920, 72),
    members: []
  };
}

const byId = (cards: SummaryCardModel[], id: string) => cards.find((c) => c.id === id)!;
const body = <K extends SummaryCardBody['kind']>(card: SummaryCardModel, kind: K) => {
  expect(card.body?.kind).toBe(kind);
  return card.body as Extract<SummaryCardBody, { kind: K }>;
};

describe('teamScheduleSummaryCards', () => {
  it('orders the cards and points each at its popup section', () => {
    expect(teamScheduleSummaryCards(day([]), week()).map((c) => [c.id, c.section])).toEqual([
      ['ts-coverage', 'coverage'],
      ['ts-plan-actual', 'planned-actual'],
      ['ts-needs-plan', 'ranking'],
      ['ts-now', 'status']
    ]);
  });

  it("shows this week's schedule coverage with planned hours and the change", () => {
    const c = body(byId(teamScheduleSummaryCards(day([]), week()), 'ts-coverage'), 'meter');
    expect(c.figure).toBe('78%');
    expect(c.percent).toBe(78);
    expect(c.caption).toBe('156 / 200 h planned');
    expect(c.delta).toEqual({ text: '+6.0 pp', good: true, suffix: 'vs last week' });
  });

  it('says the planner is off instead of a coverage', () => {
    const c = body(byId(teamScheduleSummaryCards(day([], false), week(false)), 'ts-coverage'), 'meter');
    expect(c.figure).toBe('—');
    expect(c.percent).toBeNull();
    expect(c.caption).toBe('Planner is off');
    expect(c.delta).toBeNull();
  });

  it('pairs planned (tasks + meetings) and clocked hours per day', () => {
    const p = body(byId(teamScheduleSummaryCards(day([]), week()), 'ts-plan-actual'), 'pair');
    expect(p.pairs).toEqual([
      [8, 7],
      [8, 6]
    ]);
    expect(p.figure).toBe('81%');
    expect(p.legend).toEqual(['Planned', 'Actual']);
  });

  it('marks the week cards loading until the week arrives', () => {
    const cards = teamScheduleSummaryCards(day([]), null);
    expect(byId(cards, 'ts-coverage').state).toBe('loading');
    expect(byId(cards, 'ts-plan-actual').state).toBe('loading');
    expect(byId(cards, 'ts-needs-plan').state).toBe('ready');
  });

  it('lists people without a plan first, then the most over capacity', () => {
    const members = [
      member('Joel P', { plannedTaskMinutes: 528 }),
      member('Hari S', noPlan),
      member('Meena L', { plannedTaskMinutes: 576 }),
      member('No window', { plannedTaskMinutes: 900, expectedMinutes: null }),
      member('Fine', { plannedTaskMinutes: 300 })
    ];
    const r = body(byId(teamScheduleSummaryCards(day(members), week()), 'ts-needs-plan'), 'rank');
    expect(r.rows.map((x) => [x.name, x.chips[0].text, x.chips[0].tone])).toEqual([
      ['Hari S', 'not planned', 'var(--color-widget-shade-4)'],
      ['Meena L', '120% load', 'var(--color-widget-maroon)'],
      ['Joel P', '110% load', 'var(--color-widget-shade-3)']
    ]);
  });

  it('says so when everyone has a plan within capacity', () => {
    const r = body(byId(teamScheduleSummaryCards(day([member('Fine')]), week()), 'ts-needs-plan'), 'rank');
    expect(r.rows).toEqual([]);
    expect(r.empty).toBe('Everyone has a plan');
  });

  it('counts who is working, in a meeting, on a break, on leave or not planned right now', () => {
    const meeting = { kind: 'meeting' as const, taskId: 'm', title: 'M', start: '', end: '', status: 'in_meeting' as const, isPrivate: false };
    const members = [
      member('A'),
      member('B', { items: [meeting] }),
      member('C', { presenceStatus: 'on_break' }),
      member('D', { presenceStatus: 'on_leave' }),
      member('E', { presenceStatus: null, ...noPlan })
    ];
    const c = body(byId(teamScheduleSummaryCards(day(members), week()), 'ts-now'), 'chips');
    expect(c.count).toBe('5');
    // Presence only, so the chips add up to the head count (Not planned has its own card).
    expect(c.items.map((i) => [i.label, i.value])).toEqual([
      ['Working', 1],
      ['In meeting', 1],
      ['On break', 1],
      ['On leave', 1],
      ['Not in', 1]
    ]);
  });

  it('shows both week cards as failed when the week could not load', () => {
    const cards = teamScheduleSummaryCards(day([]), null, true);
    expect(byId(cards, 'ts-coverage').state).toBe('error');
    expect(byId(cards, 'ts-plan-actual').state).toBe('error');
    expect(byId(cards, 'ts-needs-plan').state).toBe('ready');
  });
});
