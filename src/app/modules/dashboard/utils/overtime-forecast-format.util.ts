import { ForecastHours, ForecastStatus } from '../models/overtime-forecast.model';
import { DashboardDonutSlice } from '../ui/dashboard-donut/dashboard-donut.component';
import { formatPercent } from './team-progress-format.util';

/**
 * The shared visual language of the two overtime forecast widgets (design 2026-11-08, §5): where the remaining
 * hours go (covered at the current rate, needing a higher rate, needing overtime) and the four status chips.
 */
export const FORECAST_COLORS = {
  covered: '#10b981',
  raise: '#fbbf24',
  overtime: '#f87171',
  noHistory: '#94a3b8',
  /** Hours still to do (bar charts). */
  remaining: '#3b82f6',
} as const;

export type ForecastSliceKey = 'covered' | 'raise' | 'overtime';

export const FORECAST_SLICE_LABELS: Record<ForecastSliceKey, string> = {
  covered: 'Covered at current rate',
  raise: 'Needs a higher rate',
  overtime: 'Needs overtime',
};

export interface ForecastStatusMeta {
  readonly label: string;
  readonly color: string;
}

export const FORECAST_STATUS_META: Record<ForecastStatus, ForecastStatusMeta> = {
  on_track: { label: 'On track', color: FORECAST_COLORS.covered },
  raise_rate: { label: 'Raise rate', color: FORECAST_COLORS.raise },
  overtime: { label: 'Overtime', color: FORECAST_COLORS.overtime },
  no_history: { label: 'No history', color: FORECAST_COLORS.noHistory },
};

/** Summary-card tones (theme tokens) per status. */
export const FORECAST_STATUS_TONE: Record<ForecastStatus, string> = {
  on_track: 'var(--color-cat-green)',
  raise_rate: 'var(--color-cat-amber)',
  overtime: 'var(--color-cat-red)',
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

/** The hero figure: "~950 h overtime", or "On track" when nothing is short. */
export function forecastHeroText(overtimeHours: number): string {
  return overtimeHours > 0 ? `~${forecastHoursText(overtimeHours)} overtime` : 'On track';
}

/** "Needs 58% task rate · now 42%"; without history "No task history in the last 4 weeks". */
export function forecastHeroCaption(teamRate: number | null, requiredRate: number | null): string {
  if (teamRate === null) return 'No task history in the last 4 weeks';
  if (requiredRate === null) return `No working days left · now ${rateText(teamRate)}`;
  return `Needs ${rateText(requiredRate)} task rate · now ${rateText(teamRate)}`;
}

/** The overtime chip of a ranking row: "~12 h" or the status label when nothing is short. */
export function overtimeChipText(overtimeHours: number, status: ForecastStatus): string {
  return overtimeHours > 0 ? `~${forecastHoursText(overtimeHours)}` : FORECAST_STATUS_META[status].label;
}

/**
 * The donut: where the remaining hours go. Covered = min(predicted, remaining); a higher rate =
 * min(capacity, remaining) − covered; overtime = max(0, remaining − capacity). Shares are of the remaining hours.
 */
export function forecastSlices(t: Pick<ForecastHours, 'remainingHours' | 'predictedHours' | 'capacityHours'>): DashboardDonutSlice[] {
  const remaining = Math.max(0, t.remainingHours);
  const covered = Math.min(Math.max(0, t.predictedHours), remaining);
  const raise = Math.max(0, Math.min(Math.max(0, t.capacityHours), remaining) - covered);
  const overtime = Math.max(0, remaining - Math.max(0, t.capacityHours));
  const row = (key: ForecastSliceKey, value: number): DashboardDonutSlice => ({
    key,
    label: FORECAST_SLICE_LABELS[key],
    value,
    valueText: forecastHoursText(value),
    percentText: remaining > 0 ? formatPercent(value, remaining) : '0%',
    color: FORECAST_COLORS[key],
  });
  return [row('covered', covered), row('raise', raise), row('overtime', overtime)];
}

/** The donut's accessible reading. */
export function forecastDonutLabel(teamRate: number | null, slices: readonly DashboardDonutSlice[]): string {
  return `Team task rate ${rateText(teamRate)} over the last 4 weeks. Remaining hours: ` + slices.map((s) => `${s.label} ${s.valueText}`).join(', ');
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
