import { ForecastHours, ForecastStatus } from '../models/overtime-forecast.model';
import { DashboardDonutSlice } from '../ui/dashboard-donut/dashboard-donut.component';
import { formatPercent } from './team-progress-format.util';

/**
 * The shared visual language of the two overtime forecast widgets (design 2026-11-08, §5): where the remaining
 * hours go (covered at the current rate, needing a higher rate, beyond the realistic rate limit) and the four status
 * chips. Overload has its own darker red and a filled badge, so it never reads as the "won't fit" hours red.
 */
export const FORECAST_COLORS = {
  covered: '#10b981',
  raise: '#fbbf24',
  /** Hours that won't fit at today's rate. */
  overtime: '#f87171',
  /** Required rate above the realistic limit: a darker, filled treatment. */
  overload: '#991b1b',
  noHistory: '#94a3b8',
  /** Hours still to do (bar charts). */
  remaining: '#3b82f6',
} as const;

export type ForecastSliceKey = 'covered' | 'raise' | 'overload';

/** The tenant's default realistic task-rate limit, used until a response carries its own. */
export const DEFAULT_MAX_TASK_RATE = 0.9;

export function forecastSliceLabel(key: ForecastSliceKey, maxTaskRate: number): string {
  if (key === 'covered') return 'Covered at current rate';
  if (key === 'raise') return 'Needs a higher rate';
  return `Beyond the ${rateText(maxTaskRate)} limit`;
}

export interface ForecastStatusMeta {
  readonly label: string;
  readonly color: string;
}

export const FORECAST_STATUS_META: Record<ForecastStatus, ForecastStatusMeta> = {
  on_track: { label: 'On track', color: FORECAST_COLORS.covered },
  raise_rate: { label: 'Overtime risk', color: FORECAST_COLORS.raise },
  overload: { label: 'Overload', color: FORECAST_COLORS.overload },
  no_history: { label: 'No history', color: FORECAST_COLORS.noHistory },
};

/** One of the card's KPI tiles. */
export interface ForecastTileRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** The exact figure, as the tile's tooltip. */
  readonly title: string;
  readonly color: string;
}

/** Summary-card tones (theme tokens) per status. */
export const FORECAST_STATUS_TONE: Record<ForecastStatus, string> = {
  on_track: 'var(--color-cat-green)',
  raise_rate: 'var(--color-cat-amber)',
  overload: 'var(--color-danger-text)',
  no_history: 'var(--color-cat-slate)',
};

/** Hours as the widgets print them: whole from 10 h ("950 h"), one decimal below ("12.5 h" stays, "2.5 h"). */
export function forecastHoursText(hours: number): string {
  const h = Math.max(0, hours);
  if (h === 0) return '0 h';
  const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
  return `${rounded.toLocaleString('en-US')} h`;
}

/** A rate (fraction) as a percent: "42%", "140%" over one, "—" without history or capacity. */
export function rateText(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  if (rate >= 1) return `${Math.round(rate * 100)}%`;
  return formatPercent(rate * 100, 100);
}

/** A rate as a bar width, 0..100 (a required rate over 100% fills the track). */
export function rateBarPercent(rate: number | null): number {
  if (rate === null || !Number.isFinite(rate)) return 0;
  return Math.min(100, Math.max(0, rate * 100));
}

/**
 * The hours that won't fit before the deadline at today's rate (`overtimeHours` = max(0, remaining − predicted),
 * task hours, never above remaining), signed: "+7,621 h". A minus or a tilde reads as a negative at chip size.
 */
export function shortHoursText(hours: number): string {
  return `+${forecastHoursText(hours)}`;
}

/** The hero figure: "~7,621 h", or "On track" when everything fits. */
export function forecastHeroText(overtimeHours: number): string {
  return overtimeHours > 0 ? `~${forecastHoursText(overtimeHours)}` : 'On track';
}

/** The line under the hero figure. */
export function forecastHeroSub(overtimeHours: number): string {
  return overtimeHours > 0 ? "won't fit at today's rate" : "Everything fits at today's rate";
}

/** "Needs 58% task rate · now 42%"; without history "No task history in the last 4 weeks". */
export function forecastHeroCaption(teamRate: number | null, requiredRate: number | null): string {
  if (teamRate === null) return 'No task history in the last 4 weeks';
  if (requiredRate === null) return `No working days left · now ${rateText(teamRate)}`;
  return `Needs ${rateText(requiredRate)} task rate · now ${rateText(teamRate)}`;
}

/** "26% → needs 45%": the current task rate beside the rate the work needs. */
export function rateVsRequiredText(rate: number | null, requiredRate: number | null): string {
  return `${rateText(rate)} → needs ${rateText(requiredRate)}`;
}

/** The short form for chips: "26% → 45%". */
export function rateVsRequiredShort(rate: number | null, requiredRate: number | null): string {
  return `${rateText(rate)} → ${rateText(requiredRate)}`;
}

/** A summary card's ranked-row chip: "26% → 45%", or "⚠ 26% → 140%" in the overload tone. */
export function forecastRankChip(
  rate: number | null,
  requiredRate: number | null,
  status: ForecastStatus,
): { text: string; tone: string } {
  const text = rateVsRequiredShort(rate, requiredRate);
  return status === 'overload'
    ? { text: `⚠ ${text}`, tone: FORECAST_STATUS_TONE.overload }
    : { text, tone: FORECAST_STATUS_TONE[status] };
}

/** The overload badge's text. */
export const OVERLOAD_BADGE_TEXT = '⚠ Overload';

/** The popup intro's one line about the limit: "Above 90% task rate is treated as overload." */
export function overloadLimitText(maxTaskRate: number): string {
  return `Above ${rateText(maxTaskRate)} task rate is treated as overload.`;
}

/** The chip of a ranking row: "+12 h" (won't fit) or the status label when everything fits. */
export function overtimeChipText(overtimeHours: number, status: ForecastStatus): string {
  return overtimeHours > 0 ? shortHoursText(overtimeHours) : FORECAST_STATUS_META[status].label;
}

/**
 * The donut: where the remaining hours go. With the realistic limit L (`maxTaskRate`), the most the team can do is
 * capacity × L. Covered = min(predicted, remaining); a higher rate = min(capacity × L, remaining) − covered;
 * overload = max(0, remaining − capacity × L). Shares are of the remaining hours.
 */
export function forecastSlices(
  t: Pick<ForecastHours, 'remainingHours' | 'predictedHours' | 'capacityHours'>,
  maxTaskRate: number = DEFAULT_MAX_TASK_RATE,
): DashboardDonutSlice[] {
  const remaining = Math.max(0, t.remainingHours);
  const reachable = Math.max(0, t.capacityHours) * Math.max(0, maxTaskRate);
  const covered = Math.min(Math.max(0, t.predictedHours), remaining);
  const raise = Math.max(0, Math.min(reachable, remaining) - covered);
  const overload = Math.max(0, remaining - Math.max(reachable, covered));
  const row = (key: ForecastSliceKey, value: number): DashboardDonutSlice => ({
    key,
    label: forecastSliceLabel(key, maxTaskRate),
    value,
    valueText: forecastHoursText(value),
    percentText: remaining > 0 ? formatPercent(value, remaining) : '0%',
    color: FORECAST_COLORS[key],
  });
  return [row('covered', covered), row('raise', raise), row('overload', overload)];
}

/** The donut's accessible reading. */
export function forecastDonutLabel(
  teamRate: number | null,
  slices: readonly DashboardDonutSlice[],
): string {
  return (
    `Team task rate ${rateText(teamRate)} over the last 4 weeks. Remaining hours: ` +
    slices.map((s) => `${s.label} ${s.valueText}`).join(', ')
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20 Nov" from yyyy-MM-dd ("—" for null). */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** The rate window as words: "11 Oct – 7 Nov". */
export function windowLabel(start: string, end: string): string {
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** Hours from minutes, for member rows ("12.5 h"). */
export function minutesAsHours(minutes: number): string {
  return forecastHoursText(minutes / 60);
}
