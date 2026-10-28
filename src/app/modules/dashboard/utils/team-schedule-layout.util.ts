/** How the Today's team schedule card lays itself out at its rendered size. */
export type ScheduleView = 'mini' | 'medium' | 'large';

/**
 * Size thresholds in CSS pixels, measured on the card host (96px rows with 12px gaps; a column is about 97px wide at
 * 1440px). Mini = a 2-column or 2-row card; large needs room for the hour axis and a row per person.
 */
export const SCHEDULE_BREAKPOINTS = {
  mediumWidth: 300,
  mediumHeight: 300,
  largeWidth: 640,
  largeHeight: 420
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const SCHEDULE_HYSTERESIS = 20;

/** People the medium view lists. */
export const SCHEDULE_MEDIUM_ROWS = 5;

export function classifyScheduleSize(width: number, height: number): ScheduleView {
  const b = SCHEDULE_BREAKPOINTS;
  if (width < b.mediumWidth || height < b.mediumHeight) return 'mini';
  return width >= b.largeWidth && height >= b.largeHeight ? 'large' : 'medium';
}

/** The view for a rendered size, keeping the previous one inside the hysteresis band; a zero size keeps it too. */
export function scheduleView(width: number, height: number, previous: ScheduleView | null = null): ScheduleView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'medium';
  const next = classifyScheduleSize(width, height);
  if (!previous || next === previous) return next;
  const h = SCHEDULE_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyScheduleSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}
