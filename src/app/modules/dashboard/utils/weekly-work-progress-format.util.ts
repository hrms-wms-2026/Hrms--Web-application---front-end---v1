import { KpiTile } from '../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { WeekProgress, WeeklyProgressStatus } from '../models/weekly-work-progress.model';
import { formatMinutes } from '../util/timeline-segments.util';

export const WEEKLY_STATUS_LABELS: Record<WeeklyProgressStatus, string> = {
  ahead: 'Ahead',
  on_track: 'On Track',
  behind: 'Behind',
  no_target: 'No target'
};

/** A tile of the card (KPI tile, stacked row or mini tile). */
export interface WeeklyTile extends KpiTile {
  readonly key: 'expected' | 'scheduled' | 'worked' | 'remaining';
}

/** "+12%" / "−5%" with its arrow, or null when there is nothing to compare with. */
export interface WeeklyDelta {
  readonly up: boolean;
  readonly text: string;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part * 100) / whole) : 0;
}

/** The Monday a week before a yyyy-MM-dd Monday, without a time-zone shift. */
export function mondayBefore(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
}

/** Expected, Scheduled (planner only), Worked and Remaining, with their shares of Expected as hints. */
export function weeklyTiles(week: WeekProgress, plannerEnabled: boolean): WeeklyTile[] {
  const tiles: WeeklyTile[] = [
    { key: 'expected', label: 'Expected', value: formatMinutes(week.expectedMinutes), icon: 'clipboard-list', tone: 'accent' }
  ];
  if (plannerEnabled) {
    tiles.push({
      key: 'scheduled', label: 'Scheduled', value: formatMinutes(week.scheduledMinutes),
      hint: `(${Math.round(week.planningCoveragePercent)}%)`, icon: 'layers', tone: 'accent'
    });
  }
  tiles.push(
    {
      key: 'worked', label: 'Worked', value: formatMinutes(week.workedMinutes),
      hint: `(${Math.round(week.progressPercent)}%)`, icon: 'check-circle', tone: 'success'
    },
    {
      key: 'remaining', label: 'Remaining', value: formatMinutes(week.remainingMinutes),
      hint: `(${percentOf(week.remainingMinutes, week.expectedMinutes)}%)`, icon: 'clock', tone: 'warning'
    }
  );
  return tiles;
}

/** Change of a figure against last week as a percentage of last week's; null when last week had none. */
export function changeAgainst(current: number, previous: number): WeeklyDelta | null {
  if (previous <= 0) return null;
  const change = Math.round(((current - previous) * 100) / previous);
  return { up: change >= 0, text: `${change >= 0 ? '+' : '−'}${Math.abs(change)}%` };
}
