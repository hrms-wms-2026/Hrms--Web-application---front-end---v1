import { SummaryCardModel, SummaryRankRow } from '../models/summary-card.model';
import { TeamWorkTaskHoursResponse, TeamWorkTaskPeriod } from '../models/team-work-task.model';
import { summaryDelta } from './summary-card-format.util';
import { SUMMARY_CARD_ROWS } from './team-attendance-summary-cards.util';
import { WIDGET } from './widget-palette';

const TONE = {
  share: WIDGET.shade2,
  days: WIDGET.shade2b,
  gap: WIDGET.shade3,
  done: WIDGET.shade1,
  break: WIDGET.shade3b
} as const;
/** Chip tones: a big gap is maroon, a small one the mild chip. */
const RED = WIDGET.maroon;
const AMBER = WIDGET.shade3;
/** Every colour these cards use, for the colour guard spec. */
export const TEAM_WORK_TASK_CARD_COLORS = { ...TONE, red: RED, amber: AMBER } as const;
/** From this many hours worked off tasks a gap chip is red. */
const GAP_RED_HOURS = 8;

const hours = (minutes: number): number => Math.round(minutes / 60);
const VERSUS: Record<TeamWorkTaskPeriod, string> = { day: 'vs yesterday', week: 'vs last week', month: 'vs last month' };

/**
 * Work vs task hours's summary cards (design 2026-11-07), all from the one work-vs-task response the card already
 * loads: task share of working time and tasks completed (the popup's KPI row), worked vs task hours by day (the daily
 * chart), the biggest gaps (the employee table, worked minus task hours) and break time (taller views only).
 */
export function teamWorkTaskSummaryCards(data: TeamWorkTaskHoursResponse): SummaryCardModel[] {
  const t = data.totals;
  const p = data.previous;
  const versus = VERSUS[data.period];
  const share = t.utilization;
  const gaps: SummaryRankRow[] = data.employees
    .filter((e) => e.workedMinutes > 0)
    .map((e) => ({ e, gap: hours(e.workedMinutes - e.taskMinutes) }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, SUMMARY_CARD_ROWS)
    .map(({ e, gap }) => ({ id: e.employeeId, name: e.name, avatarFileId: e.avatarFileId, chips: [{ text: `+${gap} h`, tone: gap >= GAP_RED_HOURS ? RED : AMBER }] }));

  return [
    {
      id: 'wt-share',
      title: 'Task share of work',
      icon: 'pie-chart',
      tone: TONE.share,
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'spark',
        figure: share === null ? '—' : `${Math.round(share)}%`,
        delta: share === null || p.utilization === null ? null : summaryDelta(share - p.utilization, 'pp', true, versus),
        points: data.trend.map((d) => d.utilization)
      }
    },
    {
      id: 'wt-days',
      title: 'Work vs task by day',
      icon: 'bar-chart',
      tone: TONE.days,
      section: 'daily',
      state: 'ready',
      body: {
        kind: 'pair',
        figure: `${hours(t.workedMinutes)} / ${hours(t.taskMinutes)} h`,
        // Only worth a line when some worked time went elsewhere.
        delta: t.workedMinutes > t.taskMinutes ? summaryDelta(hours(t.workedMinutes - t.taskMinutes), 'h', false, 'not on tasks') : null,
        pairs: data.trend.map((d) => [hours(d.workedMinutes), hours(d.taskMinutes)] as const),
        legend: ['Worked', 'Task']
      }
    },
    {
      id: 'wt-gap',
      title: 'Biggest gap',
      icon: 'arrows-diff',
      tone: TONE.gap,
      section: 'employees',
      state: 'ready',
      body: { kind: 'rank', count: null, countLabel: '', rows: gaps, empty: 'No gaps' }
    },
    {
      id: 'wt-done',
      title: 'Tasks completed',
      icon: 'list-checks',
      tone: TONE.done,
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'bars',
        figure: t.completedTasks.toLocaleString('en-US'),
        delta: summaryDelta(t.completedTasks - p.completedTasks, '', true, versus),
        values: data.trend.map((d) => d.completedTasks)
      }
    },
    {
      // Fifth: only taller views use it (the 2-row strip shows four), in place of the Break tile.
      id: 'wt-break',
      title: 'Break time',
      icon: 'clock',
      tone: TONE.break,
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'bars',
        figure: `${hours(t.breakMinutes)} h`,
        delta: summaryDelta(hours(t.breakMinutes - p.breakMinutes), 'h', false, versus),
        values: data.trend.map((d) => hours(d.breakMinutes))
      }
    }
  ];
}
