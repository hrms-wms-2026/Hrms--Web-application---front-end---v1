import { describe, expect, it } from 'vitest';
import { LedHourTotals, LedOverdueTask, LedProjectProgress, LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { SummaryCardBody, SummaryCardModel } from '../models/summary-card.model';
import { LedEmployeeProgress, LedWeeklyCompletion } from '../models/team-progress-detail.model';
import { teamProgressSummaryCards } from './team-progress-summary-cards.util';

const hours = (allocated: number, completed: number): LedHourTotals => ({
  allocatedHours: allocated,
  completedHours: completed,
  inProgressHours: 0,
  notStartedHours: 0,
  untaskedHours: 0,
  overTaskedHours: 0,
  taskCount: 0,
  unestimatedTaskCount: 0
});
const project = (name: string, allocated: number, completed: number): LedProjectProgress => ({
  projectId: name,
  projectName: name,
  identifier: name,
  hours: hours(allocated, completed),
  modules: []
});
const overdue = (title: string, days: number, assignee = 'Ravi K'): LedOverdueTask => ({
  taskId: title,
  shortId: title,
  title,
  projectId: 'p',
  objectiveId: 'o',
  dueDate: '2026-11-01',
  daysOverdue: days,
  assignees: [{ employeeId: 'e', displayName: assignee }],
  estimatedHours: 2
});

function led(over: Partial<LedWorkProgressResponse> = {}): LedWorkProgressResponse {
  return {
    hours: hours(100, 12),
    projects: [project('Portal', 100, 22), project('Payroll v2', 50, 32), project('Mobile', 20, 8), project('Empty', 0, 0)],
    overdueTasks: [overdue('Login UI', 1), overdue('API auth fix', 5), overdue('Leave report', 3)],
    overdueTotal: 7,
    modulesAtRisk: 1,
    overdueHours: 10,
    overdueUnestimatedTaskCount: 0,
    overdueByProject: [],
    ...over
  };
}

const weekly: LedWeeklyCompletion = {
  weeks: [100, 180, 210, 190, 240, 230, 265, 312].map((h, i) => ({
    weekStart: `2026-09-${10 + i}`,
    weekEnd: `2026-09-${10 + i}`,
    completedHours: h,
    completedTaskCount: 1
  })),
  allocatedHours: 1000,
  undatedCompletedHours: 0,
  undatedCompletedTaskCount: 0
};

const member = (name: string, completed: number, total: number): LedEmployeeProgress => ({
  employeeId: name,
  displayName: name,
  completedHours: completed,
  inProgressHours: total - completed,
  notStartedHours: 0,
  totalHours: total,
  taskCount: 1,
  sharedTaskCount: 0,
  sharedHours: 0
});

const byId = (cards: SummaryCardModel[], id: string) => cards.find((c) => c.id === id)!;
const body = <K extends SummaryCardBody['kind']>(card: SummaryCardModel, kind: K) => {
  expect(card.body?.kind).toBe(kind);
  return card.body as Extract<SummaryCardBody, { kind: K }>;
};
const ready = { rows: [] as LedEmployeeProgress[], error: false };

describe('teamProgressSummaryCards', () => {
  it('orders the cards like the popup', () => {
    expect(teamProgressSummaryCards(led(), weekly, ready).map((c) => [c.id, c.section])).toEqual([
      ['tp-weekly', 'weekly'],
      ['tp-projects', 'projects'],
      ['tp-overdue', 'overdue'],
      ['tp-behind', 'members']
    ]);
  });

  it("shows this week's completed hours, the change on last week and the last seven weeks", () => {
    const w = body(byId(teamProgressSummaryCards(led(), weekly, ready), 'tp-weekly'), 'bars');
    expect(w.figure).toBe('312 h');
    // The current week is still running: the change says so.
    expect(w.delta).toEqual({ text: '+18%', good: true, suffix: 'so far vs last week' });
    expect(w.values).toEqual([180, 210, 190, 240, 230, 265, 312]);
  });

  it('marks the weekly card loading without the weekly payload', () => {
    expect(byId(teamProgressSummaryCards(led(), null, ready), 'tp-weekly').state).toBe('loading');
  });

  it('lists the three projects furthest along with the project count', () => {
    const p = body(byId(teamProgressSummaryCards(led(), weekly, ready), 'tp-projects'), 'hbars');
    expect(p.headline).toBe('4 active projects');
    expect(p.rows.map((r) => [r.label, r.percent])).toEqual([
      ['Payroll v2', 64],
      ['Mobile', 40],
      ['Portal', 22]
    ]);
  });

  it('ranks overdue tasks by days late, red from three days', () => {
    const o = body(byId(teamProgressSummaryCards(led(), weekly, ready), 'tp-overdue'), 'rank');
    expect(o.count).toBe('7');
    expect(o.countLabel).toBe('overdue');
    expect(o.rows.map((r) => [r.name, r.chips[0].text])).toEqual([
      ['API auth fix', '5 d late'],
      ['Leave report', '3 d late'],
      ['Login UI', '1 d late']
    ]);
    expect(o.rows[0].chips[0].tone).toBe('var(--color-widget-maroon)');
    expect(o.rows[2].chips[0].tone).toBe('var(--color-widget-shade-3)');
  });

  it('says so when nothing is overdue', () => {
    const o = body(byId(teamProgressSummaryCards(led({ overdueTasks: [], overdueTotal: 0 }), weekly, ready), 'tp-overdue'), 'rank');
    expect(o.rows).toEqual([]);
    expect(o.empty).toBe('Nothing overdue');
  });

  it('lists the members furthest behind with their completed share', () => {
    const rows = [member('Dinesh V', 1, 12), member('Lakshmi M', 3, 20), member('Idle', 0, 0)];
    const b = body(byId(teamProgressSummaryCards(led(), weekly, { rows, error: false }), 'tp-behind'), 'rank');
    expect(b.rows.map((r) => [r.name, r.chips[0].text])).toEqual([
      ['Dinesh V', '8% done'],
      ['Lakshmi M', '15% done']
    ]);
    expect(byId(teamProgressSummaryCards(led(), weekly, { rows: null, error: true }), 'tp-behind').state).toBe('error');
  });

  it('shows the weekly card as failed when weekly completion could not load', () => {
    const card = byId(teamProgressSummaryCards(led(), null, ready, true), 'tp-weekly');
    expect(card.state).toBe('error');
    expect(card.body).toBeNull();
  });

  it('leaves people who have finished everything out of Falling behind', () => {
    const rows = [member('Dinesh V', 1, 12), member('Done D', 10, 10)];
    const b = body(byId(teamProgressSummaryCards(led(), weekly, { rows, error: false }), 'tp-behind'), 'rank');
    expect(b.rows.map((r) => r.name)).toEqual(['Dinesh V']);
    const all = body(byId(teamProgressSummaryCards(led(), weekly, { rows: [member('Done D', 10, 10)], error: false }), 'tp-behind'), 'rank');
    expect(all.rows).toEqual([]);
  });

  it('leaves the all-time Projects card out while the widget shows a week or month', () => {
    const ids = teamProgressSummaryCards(led(), weekly, ready, false, false).map((c) => c.id);
    expect(ids).toEqual(['tp-weekly', 'tp-overdue', 'tp-behind']);
  });
});
