/** How the Team Progress card lays itself out at its current rendered size. */
export type TeamProgressMode = 'compact' | 'medium' | 'wide' | 'tall' | 'large' | 'maximum';

/**
 * Size thresholds in CSS pixels, measured on the card host. The dashboard grid uses 96px rows with a
 * 12px gap, so 4 rows ≈ 420px, 5 ≈ 528, 6 ≈ 636, 7 ≈ 744 and 8 ≈ 852; each height threshold sits
 * in the middle of a gap between two row counts, so a card snapped to the grid is never near one.
 */
export const TEAM_PROGRESS_BREAKPOINTS = {
  /** Below this width only the compact (short) or tall (long) layouts fit. */
  mediumWidth: 560,
  /** From this width the donut and a detailed breakdown fit side by side. */
  wideWidth: 780,
  /** From this width the maximum layout (three lists side by side) fits. */
  maximumWidth: 1150,
  /** From this height there is room for a module list below the breakdown (between 5 and 6 rows). */
  tallHeight: 580,
  /** From this height (and maximumWidth) the maximum layout applies (between 7 and 8 rows). */
  maximumHeight: 800
} as const;

/** How far past a threshold the size must move before the mode changes back, so a card resized
 * slowly across a threshold doesn't flip between layouts on every frame. */
export const TEAM_PROGRESS_HYSTERESIS = 20;

/** The mode for a size, with no hysteresis. */
export function classifyTeamProgressSize(width: number, height: number): TeamProgressMode {
  const b = TEAM_PROGRESS_BREAKPOINTS;
  const tall = height >= b.tallHeight;
  if (width < b.mediumWidth) return tall ? 'tall' : 'compact';
  if (width < b.wideWidth) return tall ? 'tall' : 'medium';
  if (width < b.maximumWidth) return tall ? 'large' : 'wide';
  if (!tall) return 'wide';
  return height >= b.maximumHeight ? 'maximum' : 'large';
}

/**
 * The mode for a rendered size. The previous mode is kept while the size is within
 * TEAM_PROGRESS_HYSTERESIS of a size that would still give it. A size of zero (not laid out yet, or
 * hidden) keeps the previous mode, or 'compact' when there is none.
 */
export function resolveTeamProgressMode(
  width: number,
  height: number,
  previous: TeamProgressMode | null = null
): TeamProgressMode {
  if (!(width > 0) || !(height > 0)) return previous ?? 'compact';
  const next = classifyTeamProgressSize(width, height);
  if (!previous || next === previous) return next;
  const h = TEAM_PROGRESS_HYSTERESIS;
  // Thresholds are far more than 2 * h apart, so probing the corners and edges of the tolerance box
  // is enough to tell whether the previous mode is still "close enough".
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyTeamProgressSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

/** Roughly how tall one row of a module / project / overdue list is (title line + thin bar). */
export const TEAM_PROGRESS_LIST_ROW_PX = 42;

/** Height the card spends outside every mode's own content: card padding plus its title header. */
const CARD_CHROME_PX = 84;

/** Height used above the lists in each mode (summary sections, list headings and the footer). */
const FIXED_CONTENT_PX: Record<TeamProgressMode, number> = {
  compact: Number.POSITIVE_INFINITY,
  medium: Number.POSITIVE_INFINITY,
  wide: Number.POSITIVE_INFINITY,
  // Donut stacked over a four-row breakdown, the list heading and the footer.
  tall: 420,
  // Donut + breakdown row, metrics strip, list headings and the footer.
  large: 330,
  // Donut + breakdown + metrics row and the list headings.
  maximum: 300
};

/**
 * How many rows each list (led modules, projects, overdue tasks) shows in a mode at a height - the
 * rest stay behind a "+N more" link. 0 in modes with no lists; never more than 20.
 */
export function teamProgressListBudget(mode: TeamProgressMode, height: number): number {
  const fixed = FIXED_CONTENT_PX[mode];
  if (!Number.isFinite(fixed) || !(height > 0)) return 0;
  const rows = Math.floor((height - CARD_CHROME_PX - fixed) / TEAM_PROGRESS_LIST_ROW_PX);
  return Math.max(1, Math.min(20, rows));
}
