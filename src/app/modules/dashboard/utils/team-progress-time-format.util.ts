import {
  LedProgressPeriod,
  LedTimePeriod,
  LedTimeProgress,
} from '../models/team-progress-detail.model';
import { PlannedActualDay } from './planned-actual-format.util';

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
  if (current == null) return null;
  if (previous == null) return 'New';
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
  if (time.coveragePercent == null)
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

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A bucket's column label: the weekday for a one-day bucket (week), else "26–1" (a week of a month). */
export function bucketLabel(from: string, to: string): string {
  const [y, m, d] = from.split('-').map(Number);
  if (from === to) return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d}–${Number(to.split('-')[2])}`;
}

/**
 * The time buckets as app-planned-actual-week-chart columns: planned against in plan + unscheduled (the buckets do not
 * split outside slot from no plan, so all of it reads as no plan). A bucket's coverage (in plan / planned, capped at 100)
 * only once it has ended before today; a later bucket is future (planned only).
 */
export function bucketChart(time: LedTimeProgress, today: string): { days: PlannedActualDay[]; labels: string[]; today: string } {
  const days = time.buckets.map((b) => ({
    date: b.from,
    planned: b.plannedMinutes,
    scheduled: b.scheduledMinutes,
    outside: 0,
    noPlan: b.unscheduledMinutes,
    coveragePercent:
      b.to < today && b.plannedMinutes > 0
        ? Math.min(100, Math.round((b.scheduledMinutes * 1000) / b.plannedMinutes) / 10)
        : null,
  }));
  // The chart treats a column dated after `today` as future; a month bucket that started already is not.
  const current = time.buckets.find((b) => b.from <= today && today <= b.to);
  return { days, labels: time.buckets.map((b) => bucketLabel(b.from, b.to)), today: current ? current.from : today };
}

/** Today in the viewer's zone, yyyy-MM-dd. */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
