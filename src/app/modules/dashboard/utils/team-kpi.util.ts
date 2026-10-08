import { TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { TeamTodayResponse } from '../models/my-team-today.model';
import { MyTeamWidgetKey } from '../models/my-team-widget-key.model';
import { wholeDaysSince } from './priority-actions.util';

export type TeamKpiKey = 'present' | 'approvals' | 'attention' | 'overdue';
export type TeamKpiTone = 'neutral' | 'good' | 'warning' | 'critical';

export interface TeamKpiTile {
  key: TeamKpiKey;
  /** The widget the tile summarises - the tile scrolls to it on click. */
  target: MyTeamWidgetKey;
  label: string;
  value: string;
  caption: string;
  tone: TeamKpiTone;
}

export interface TeamKpiInputs {
  visibleWidgets: readonly MyTeamWidgetKey[];
  today: TeamTodayResponse | null;
  actionItems: TeamActionItemsResponse | null;
  ledProgress: LedWorkProgressResponse | null;
  now?: Date;
}

/** One-line summary strip above the My Team widgets. Pure: reads only what the widgets' own
 * stores already fetched. A tile is omitted - never shown as "0" - when its widget is hidden or its
 * store has no data yet, so a never-fetched source can't masquerade as "all clear". */
export function buildTeamKpis(inputs: TeamKpiInputs): TeamKpiTile[] {
  const visible = new Set(inputs.visibleWidgets);
  const now = inputs.now ?? new Date();
  const tiles: TeamKpiTile[] = [];

  const today = visible.has('teamStatus') ? inputs.today : null;
  if (today && today.totalMembers > 0) {
    const s = today.summary;
    // Statuses are mutually exclusive buckets; `late` is an overlay flag, so it is not added here.
    const present = s.working + s.onBreak + s.clockedOut;
    const expected = Math.max(0, s.total - s.onLeave - s.notScheduled);
    const percent = expected === 0 ? 0 : Math.round((present / expected) * 100);
    tiles.push({
      key: 'present',
      target: 'teamStatus',
      label: 'Present today',
      value: `${present} / ${expected}`,
      caption: expected === 0 ? 'No one scheduled' : `${percent}% in`,
      tone: expected === 0 ? 'neutral' : percent >= 90 ? 'good' : percent >= 70 ? 'warning' : 'critical'
    });
    tiles.push({
      key: 'attention',
      target: 'teamStatus',
      label: 'Needs follow-up',
      value: String(s.needsAttention),
      caption: s.late > 0 ? `${s.late} late` : s.needsAttention === 0 ? 'Everyone on track' : 'Attendance issues',
      tone: s.needsAttention === 0 ? 'good' : 'warning'
    });
  }

  const actionItems = visible.has('actionCenter') ? inputs.actionItems : null;
  if (actionItems) {
    const okSources = actionItems.sources.filter((src) => src.status === 'ok' && src.sourceKey !== 'monitoring.exception');
    const partial = actionItems.sources.some((src) => src.status === 'unavailable');
    const pending = okSources.reduce((sum, src) => sum + src.pendingCount, 0);
    const oldest = okSources
      .map((src) => src.oldestPendingAt)
      .filter((at): at is string => !!at)
      .sort()[0];
    const oldestDays = oldest ? wholeDaysSince(oldest, now) : 0;
    tiles.push({
      key: 'approvals',
      target: 'actionCenter',
      label: 'Pending approvals',
      value: `${pending}${partial ? '+' : ''}`,
      caption: pending === 0 ? 'All clear' : oldest ? `Oldest ${oldestDays}d` : 'Waiting on you',
      tone: pending === 0 ? 'good' : oldestDays >= 5 ? 'critical' : oldestDays >= 3 ? 'warning' : 'neutral'
    });
  }

  const progress = visible.has('teamProgress') ? inputs.ledProgress : null;
  if (progress && progress.totals.total > 0) {
    const { overdue, total, completed } = progress.totals;
    tiles.push({
      key: 'overdue',
      target: 'teamProgress',
      label: 'Overdue tasks',
      value: String(overdue),
      caption: `${completed} of ${total} done`,
      tone: overdue === 0 ? 'good' : 'critical'
    });
  }

  const order: TeamKpiKey[] = ['present', 'approvals', 'attention', 'overdue'];
  return tiles.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
