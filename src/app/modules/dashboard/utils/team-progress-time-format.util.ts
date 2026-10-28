import {
  LedProgressPeriod,
  LedTimePeriod,
  LedTimeProgress,
} from '../models/team-progress-detail.model';

export { minutesText } from './team-presence-format.util';

/** The time figures' period for the card's switch: All time has no time window, so it reads the week. */
export function timePeriodFor(period: LedProgressPeriod): LedTimePeriod {
  return period === 'month' ? 'month' : 'week';
}

/** "↑ 6 pp vs last week" for a rate; "New" when there was nothing to compare with; null when there is no rate now. */
export function comparisonText(
  current: number | null,
  previous: number | null,
  period: LedTimePeriod,
): string | null {
  if (current === null) return null;
  if (previous === null) return 'New';
  const delta = Math.round((current - previous) * 10) / 10;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '±';
  return `${arrow} ${Math.abs(delta)} pp vs last ${period}`;
}

/** Hours with at most one decimal, for minutes: 90 -> "1.5 h". */
export function hoursText(minutes: number): string {
  return `${Math.round(minutes / 6) / 10} h`;
}

/** The coverage denominator in words, for the tooltip next to the percentage. */
export function coverageTooltip(time: LedTimeProgress): string {
  if (time.coveragePercent === null)
    return 'No planned task time yet, so there is nothing to cover.';
  return `Worked inside a matching Planner slot as a share of the planned task time so far (${time.coveragePercent}%).`;
}

/** Shares (0-100) of the planned-vs-worked band: scheduled, outside slot and no plan, scaled against whichever is larger
 * of planned and worked, plus where the planned marker sits. */
export function bandShares(time: LedTimeProgress): {
  scheduled: number;
  outside: number;
  noPlan: number;
  plannedMarker: number;
} {
  const scale = Math.max(time.plannedMinutes, time.clockedMinutes);
  const share = (n: number) => (scale > 0 ? (n * 100) / scale : 0);
  return {
    scheduled: share(time.scheduledMinutes),
    outside: share(time.outsideSlotMinutes),
    noPlan: share(time.noPlanMinutes),
    plannedMarker: share(time.plannedMinutes),
  };
}
