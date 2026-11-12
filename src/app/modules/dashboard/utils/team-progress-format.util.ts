import { WIDGET } from './widget-palette';

/** Shared by the Team Progress card and its detail dialog, so both read the same colours, labels and
 * number formats. Hours here are task estimates (weightage), never time actually worked. */

export type ProgressStatusKey = 'completed' | 'inProgress' | 'notStarted' | 'untasked';

export interface ProgressStatusMeta {
  readonly key: ProgressStatusKey;
  readonly label: string;
  /** Monochrome widget colour (a `var(--color-widget-*)` string) for donuts, dots and bar segments. */
  readonly color: string;
}

export const PROGRESS_STATUSES: readonly ProgressStatusMeta[] = [
  { key: 'completed', label: 'Completed', color: WIDGET.shade1 },
  { key: 'inProgress', label: 'In progress', color: WIDGET.shade2 },
  { key: 'notStarted', label: 'Not started', color: WIDGET.shade3 },
  { key: 'untasked', label: 'Not yet tasked', color: WIDGET.shade4 }
];

export const PROGRESS_STATUS_BY_KEY: Readonly<Record<ProgressStatusKey, ProgressStatusMeta>> = Object.fromEntries(
  PROGRESS_STATUSES.map((s) => [s.key, s])
) as Record<ProgressStatusKey, ProgressStatusMeta>;

/** Hours with thousands separators and at most one decimal: 19,715 / 12.5. */
export function formatHourValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.round(value * 10) / 10);
}

/** Share of `part` in `whole` as a number (0-100), or 0 when either is not positive. */
export function percentOf(part: number, whole: number): number {
  if (!(whole > 0) || !(part > 0)) return 0;
  return (part / whole) * 100;
}

/**
 * A percentage that never hides a real value: a non-zero share never shows as "0%" and a partial
 * share never shows as "100%". Near either end, where whole numbers would hide the difference, one
 * decimal is kept: under 10% (0.5%) and over 90% (97.6%); under 0.1% shows "<0.1%".
 */
export function formatPercent(part: number, whole: number): string {
  const p = percentOf(part, whole);
  if (p === 0) return '0%';
  if (p < 0.1) return '<0.1%';
  if (part < whole && p > 99.9) return '>99.9%';
  if (p >= 100) return '100%';
  const rounded = p < 10 || p > 90 ? Math.round(p * 10) / 10 : Math.round(p);
  if (part < whole && rounded >= 100) return '>99.9%';
  return `${rounded}%`;
}
