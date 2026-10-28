/** How the Working / Break / Leave card lays itself out at its rendered size. */
export type PresenceView = 'mini' | 'medium' | 'large';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 4 = 420, 6 = 636), and a column is about 97px wide at 1440px.
 */
export const PRESENCE_BREAKPOINTS = {
  /** Below this width or height (a 2-column or 2-row card) only the donut and the three counts fit. */
  mediumWidth: 300,
  mediumHeight: 300,
  /** From this size the rows become a table with since / elapsed / remaining / attendance columns. */
  largeWidth: 640,
  largeHeight: 480
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const PRESENCE_HYSTERESIS = 20;

/** Rows the medium view lists under the counters. */
export const PRESENCE_MEDIUM_ROWS = 5;

export function classifyPresenceSize(width: number, height: number): PresenceView {
  const b = PRESENCE_BREAKPOINTS;
  if (width < b.mediumWidth || height < b.mediumHeight) return 'mini';
  return width >= b.largeWidth && height >= b.largeHeight ? 'large' : 'medium';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it.
 * A zero size (not laid out yet, or hidden) keeps the previous view, or 'medium'. */
export function presenceView(width: number, height: number, previous: PresenceView | null = null): PresenceView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'medium';
  const next = classifyPresenceSize(width, height);
  if (!previous || next === previous) return next;
  const h = PRESENCE_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyPresenceSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}
