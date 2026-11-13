import { WIDGET } from '../../../shared/utils/widget-palette';
export { formatPercent, percentOf } from '../../../shared/utils/format-percent.util';

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

