/**
 * Monochrome dashboard widget palette. Every chart series, chip and KPI/summary card colour inside a dashboard
 * widget comes from here, as a `var(--color-widget-*)` string (defined in shared/styles/theme-tokens.css). The
 * strings are never resolved to hex, so switching the theme preset re-skins every widget at runtime.
 *
 * Shade order: the main or "done" category gets shade1, the neutral or "nothing yet" category shade4, the old amber
 * warnings shade3, and anything that was red maroon.
 */
export const WIDGET = {
  shade1: 'var(--color-widget-shade-1)',
  shade2: 'var(--color-widget-shade-2)',
  shade2b: 'var(--color-widget-shade-2b)',
  shade3: 'var(--color-widget-shade-3)',
  shade3b: 'var(--color-widget-shade-3b)',
  shade4: 'var(--color-widget-shade-4)',
  track: 'var(--color-widget-track)',
  maroon: 'var(--color-widget-maroon)',
  maroonSoft: 'var(--color-widget-maroon-soft)',
  mild: 'var(--color-widget-mild)',
  mildLine: 'var(--color-widget-mild-line)',
  /** Text on a solid shade1 or maroon chip (white in light mode, dark in dark mode). */
  onSolid: 'var(--color-widget-on-solid)',
  /** Text on a light shade fill (shade2b and lighter): dark in both modes. */
  onLight: 'var(--color-widget-on-light)'
} as const;

/** Lightness order, darkest first: shade1, shade2, shade2b, shade3, shade3b, shade4. */
export const WIDGET_RAMP: readonly string[] = [WIDGET.shade1, WIDGET.shade2, WIDGET.shade2b, WIDGET.shade3, WIDGET.shade3b, WIDGET.shade4];

/** Ramp indexes per count, spread from shade1 to shade4. n=4 uses the four main shades. */
const RAMP_PICKS: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [0, 5],
  3: [0, 3, 5],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 4, 5]
};

/** Picks `n` ramp entries spread evenly from shade1 to shade4 (n ≤ 6; larger n cycles the full ramp). */
export function widgetRamp(n: number): string[] {
  const count = Math.max(0, Math.floor(n));
  const picks = RAMP_PICKS[count];
  if (picks) return picks.map((i) => WIDGET_RAMP[i]);
  return Array.from({ length: count }, (_, i) => WIDGET_RAMP[i % WIDGET_RAMP.length]);
}

/** Stable shade for a data item (project, person): FNV-1a hash of `key` mod the ramp length. */
export function widgetShadeFor(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return WIDGET_RAMP[hash % WIDGET_RAMP.length];
}

/** Readable text on a shade fill, e.g. initials on a project swatch. */
export function widgetInkOn(shade: string): string {
  return shade === WIDGET.shade1 || shade === WIDGET.shade2 || shade === WIDGET.maroon ? WIDGET.onSolid : WIDGET.onLight;
}

const WIDGET_VALUES = new Set<string>(Object.values(WIDGET));

/** True for any WIDGET value or 'transparent'. */
export function isWidgetColor(value: string): boolean {
  return value === 'transparent' || WIDGET_VALUES.has(value);
}
