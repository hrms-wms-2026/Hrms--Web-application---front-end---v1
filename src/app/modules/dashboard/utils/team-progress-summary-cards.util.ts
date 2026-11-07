import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { SummaryCardModel, SummaryRankRow } from '../models/summary-card.model';
import { LedEmployeeProgress, LedWeeklyCompletion } from '../models/team-progress-detail.model';
import { summaryDelta } from './summary-card-format.util';
import { SUMMARY_CARD_ROWS } from './team-attendance-summary-cards.util';
import { formatHourValue } from './team-progress-format.util';

const TONE = { weekly: 'var(--color-cat-green)', projects: 'var(--color-cat-blue)', overdue: 'var(--color-cat-red)', behind: 'var(--color-cat-amber)' } as const;
const RED = 'var(--color-cat-red)';
const AMBER = 'var(--color-cat-amber)';
/** Bars the weekly card draws: the current week and the six before it. */
const WEEKLY_BARS = 7;
/** From this many days late an overdue chip is red. */
const OVERDUE_RED_DAYS = 3;
/** Under this completed share a member's chip is red. */
const BEHIND_RED_PERCENT = 10;

/** The members furthest behind, as fetched with sort 'completionRate' asc (null while loading). */
export interface BehindRows {
  readonly rows: readonly LedEmployeeProgress[] | null;
  readonly error: boolean;
}

const share = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part * 100) / whole) : null);

/**
 * Team progress's summary cards (design 2026-11-07), each from the popup section it summarises: weekly completion,
 * projects, overdue tasks and the members furthest behind (Team members, fetched with sort 'completionRate').
 */
export function teamProgressSummaryCards(
  led: LedWorkProgressResponse,
  weekly: LedWeeklyCompletion | null,
  behind: BehindRows,
  weeklyFailed = false
): SummaryCardModel[] {
  const weeks = weekly?.weeks ?? [];
  const current = weeks.at(-1)?.completedHours ?? 0;
  const previous = weeks.at(-2)?.completedHours;
  const change = previous !== undefined && previous > 0 ? ((current - previous) * 100) / previous : null;

  const projects = led.projects
    .map((p) => ({ label: p.projectName, percent: share(p.hours.completedHours, p.hours.allocatedHours), tone: TONE.projects }))
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));

  const overdue: SummaryRankRow[] = [...led.overdueTasks]
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, SUMMARY_CARD_ROWS)
    .map((t) => ({
      id: t.taskId,
      name: t.title,
      avatarFileId: null,
      chips: [{ text: `${t.daysOverdue} d late`, tone: t.daysOverdue >= OVERDUE_RED_DAYS ? RED : AMBER }]
    }));

  const behindRows: SummaryRankRow[] = (behind.rows ?? [])
    .filter((m) => m.totalHours > 0)
    .slice(0, SUMMARY_CARD_ROWS)
    .map((m) => {
      const done = share(m.completedHours, m.totalHours) ?? 0;
      return { id: m.employeeId, name: m.displayName, avatarFileId: null, chips: [{ text: `${done}% done`, tone: done < BEHIND_RED_PERCENT ? RED : AMBER }] };
    });

  return [
    {
      id: 'tp-weekly',
      title: 'Weekly completion',
      icon: 'check-circle',
      tone: TONE.weekly,
      section: 'weekly',
      state: weekly ? 'ready' : weeklyFailed ? 'error' : 'loading',
      body: weekly
        ? {
            kind: 'bars',
            figure: `${formatHourValue(current)} h`,
            delta: summaryDelta(change, '%', true, 'vs last week'),
            values: weeks.slice(-WEEKLY_BARS).map((w) => w.completedHours)
          }
        : null
    },
    {
      id: 'tp-projects',
      title: 'Projects',
      icon: 'folder',
      tone: TONE.projects,
      section: 'projects',
      state: 'ready',
      body: {
        kind: 'hbars',
        headline: `${led.projects.length} active ${led.projects.length === 1 ? 'project' : 'projects'}`,
        rows: projects.slice(0, SUMMARY_CARD_ROWS)
      }
    },
    {
      id: 'tp-overdue',
      title: 'Overdue tasks',
      icon: 'alert-triangle',
      tone: TONE.overdue,
      section: 'overdue',
      state: 'ready',
      body: { kind: 'rank', count: String(led.overdueTotal), countLabel: 'overdue', rows: overdue, empty: 'Nothing overdue' }
    },
    {
      id: 'tp-behind',
      title: 'Falling behind',
      icon: 'users',
      tone: TONE.behind,
      section: 'members',
      state: behind.rows !== null ? 'ready' : behind.error ? 'error' : 'loading',
      body: behind.rows !== null ? { kind: 'rank', count: null, countLabel: '', rows: behindRows, empty: 'No one has hours yet' } : null
    }
  ];
}
