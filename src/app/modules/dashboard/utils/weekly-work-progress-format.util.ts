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

/** "+12%" / "−5%" / "0%" with its arrow (→ when unchanged), or null when there is nothing to compare with. */
export interface WeeklyDelta {
  readonly up: boolean;
  readonly arrow: '↗' | '↘' | '→';
  readonly text: string;
}

/** A whole-number change as a delta: "+12%" ↗, "−5%" ↘, "0%" →. */
export function deltaOf(change: number): WeeklyDelta {
  if (change === 0) return { up: true, arrow: '→', text: '0%' };
  return change > 0 ? { up: true, arrow: '↗', text: `+${change}%` } : { up: false, arrow: '↘', text: `−${Math.abs(change)}%` };
}

/** Minutes as hours for the week figures: "27h", "22h 30m", and "0h" (not "0m") for nothing. */
export function formatWeekHours(minutes: number): string {
  return minutes === 0 ? '0h' : formatMinutes(minutes);
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
    { key: 'expected', label: 'Expected', value: formatWeekHours(week.expectedMinutes), icon: 'clipboard-list', tone: 'accent' }
  ];
  if (plannerEnabled) {
    tiles.push({
      key: 'scheduled', label: 'Scheduled', value: formatWeekHours(week.scheduledMinutes),
      hint: `(${Math.round(week.planningCoveragePercent)}%)`, icon: 'calendar', tone: 'accent'
    });
  }
  tiles.push(
    {
      key: 'worked', label: 'Worked', value: formatWeekHours(week.workedMinutes),
      hint: `(${Math.round(week.progressPercent)}%)`, icon: 'play', tone: 'success'
    },
    {
      key: 'remaining', label: 'Remaining', value: formatWeekHours(week.remainingMinutes),
      hint: `(${percentOf(week.remainingMinutes, week.expectedMinutes)}%)`, icon: 'clock', tone: 'warning'
    }
  );
  return tiles;
}

/** Change of a figure against last week as a percentage of last week's; null when last week had none. */
export function changeAgainst(current: number, previous: number): WeeklyDelta | null {
  if (previous <= 0) return null;
  const change = Math.round(((current - previous) * 100) / previous);
  return deltaOf(change);
}
