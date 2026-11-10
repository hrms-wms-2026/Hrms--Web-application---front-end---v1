import { describe, expect, it } from 'vitest';
import { SummaryCardBody, SummaryCardModel } from '../models/summary-card.model';
import { TeamWorkTaskEmployeeRow, TeamWorkTaskHoursResponse, TeamWorkTaskTotals } from '../models/team-work-task.model';
import { teamWorkTaskSummaryCards } from './team-work-task-summary-cards.util';

const totals = (worked: number, task: number, completed: number, utilization: number | null): TeamWorkTaskTotals => ({
  workedMinutes: worked,
  breakMinutes: 0,
  taskMinutes: task,
  completedTasks: completed,
  unestimatedTasks: 0,
  utilization
});

const employee = (name: string, worked: number, task: number): TeamWorkTaskEmployeeRow => ({
  ...totals(worked, task, 0, null),
  employeeId: name,
  name,
  avatarFileId: null,
  department: null,
  rank: null
});

function response(over: Partial<TeamWorkTaskHoursResponse> = {}): TeamWorkTaskHoursResponse {
  const point = (date: string, worked: number, task: number, done: number, utilization: number | null) => ({
    date,
    workedMinutes: worked,
    breakMinutes: 0,
    taskMinutes: task,
    completedTasks: done,
    utilization
  });
  return {
    period: 'week',
    rangeStart: '2026-11-02',
    rangeEnd: '2026-11-08',
    today: '2026-11-07',
    isProvisional: true,
    teamSize: 5,
    totals: totals(12000, 8520, 46, 71),
    previous: totals(11000, 7400, 37, 67),
    trendStart: '2026-11-02',
    trendEnd: '2026-11-08',
    trend: [point('2026-11-02', 2400, 1800, 9, 75), point('2026-11-03', 2520, 1860, 12, null)],
    employees: [employee('Sam A', 600, 240), employee('Vimal R', 2400, 1740), employee('Fine', 600, 600), employee('Idle', 0, 0), employee('Divya K', 1200, 720)],
    calculatedAtUtc: '2026-11-07T10:00:00Z',
    ...over
  };
}

const byId = (cards: SummaryCardModel[], id: string) => cards.find((c) => c.id === id)!;
const body = <K extends SummaryCardBody['kind']>(card: SummaryCardModel, kind: K) => {
  expect(card.body?.kind).toBe(kind);
  return card.body as Extract<SummaryCardBody, { kind: K }>;
};

describe('teamWorkTaskSummaryCards', () => {
  it('orders the cards and points each at its popup section', () => {
    expect(teamWorkTaskSummaryCards(response()).map((c) => [c.id, c.section])).toEqual([
      ['wt-share', 'summary'],
      ['wt-days', 'daily'],
      ['wt-gap', 'employees'],
      ['wt-done', 'summary'],
      ['wt-break', 'summary']
    ]);
  });

  it('shows the task share of working time, its change and the daily shares', () => {
    const s = body(byId(teamWorkTaskSummaryCards(response()), 'wt-share'), 'spark');
    expect(s.figure).toBe('71%');
    expect(s.delta).toEqual({ text: '+4.0 pp', good: true, suffix: 'vs last week' });
    expect(s.points).toEqual([75, null]);
  });

  it('shows a dash without working time', () => {
    const s = body(byId(teamWorkTaskSummaryCards(response({ totals: totals(0, 0, 0, null) })), 'wt-share'), 'spark');
    expect(s.figure).toBe('—');
    expect(s.delta).toBeNull();
  });

  it('pairs worked and task hours per day with the hours not on tasks', () => {
    const d = body(byId(teamWorkTaskSummaryCards(response()), 'wt-days'), 'pair');
    expect(d.figure).toBe('200 / 142 h');
    expect(d.pairs).toEqual([
      [40, 30],
      [42, 31]
    ]);
    expect(d.delta).toEqual({ text: '+58 h', good: false, suffix: 'not on tasks' });
    expect(d.legend).toEqual(['Worked', 'Task']);
  });

  it('ranks the biggest gaps between worked and task hours, red from 8 h', () => {
    const g = body(byId(teamWorkTaskSummaryCards(response()), 'wt-gap'), 'rank');
    expect(g.rows.map((r) => [r.name, r.chips[0].text, r.chips[0].tone])).toEqual([
      ['Vimal R', '+11 h', 'var(--color-cat-red)'],
      ['Divya K', '+8 h', 'var(--color-cat-red)'],
      ['Sam A', '+6 h', 'var(--color-cat-amber)']
    ]);
  });

  it('says so when nobody has a gap', () => {
    const g = body(byId(teamWorkTaskSummaryCards(response({ employees: [employee('Fine', 600, 600)] })), 'wt-gap'), 'rank');
    expect(g.rows).toEqual([]);
    expect(g.empty).toBe('No gaps');
  });

  it('shows completed tasks with the change and the daily counts', () => {
    const t = body(byId(teamWorkTaskSummaryCards(response({ period: 'month' })), 'wt-done'), 'bars');
    expect(t.figure).toBe('46');
    expect(t.delta).toEqual({ text: '+9', good: true, suffix: 'vs last month' });
    expect(t.values).toEqual([9, 12]);
  });

  it('shows break time with the change on the last period and the daily breaks', () => {
    const base = response();
    const data = response({
      totals: { ...base.totals, breakMinutes: 4860 },
      previous: { ...base.previous, breakMinutes: 4200 },
      trend: base.trend.map((d, i) => ({ ...d, breakMinutes: [600, 720][i] }))
    });
    const b = body(byId(teamWorkTaskSummaryCards(data), 'wt-break'), 'bars');
    expect(b.figure).toBe('81 h');
    expect(b.delta).toEqual({ text: '+11 h', good: false, suffix: 'vs last week' });
    expect(b.values).toEqual([10, 12]);
  });

  it('shows no "not on tasks" line when task hours cover the worked hours', () => {
    const base = response();
    const d = body(byId(teamWorkTaskSummaryCards(response({ totals: { ...base.totals, workedMinutes: 600, taskMinutes: 780 } })), 'wt-days'), 'pair');
    expect(d.delta).toBeNull();
  });
});
