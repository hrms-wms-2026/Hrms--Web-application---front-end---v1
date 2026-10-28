/** How the Team attendance card lays itself out at its rendered size. The detail dialog is the fifth view. */
export type TeamAttendanceView = 'mini' | 'small' | 'medium' | 'large';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (3 rows = 312px, 6 rows = 636px), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const TEAM_ATTENDANCE_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) only the mini view fits: today's rate and a bare ring. */
  minHeight: 260,
  /** Below this width (a 2-column card) only the mini view fits. */
  miniWidth: 280,
  /** From this width a card of any usable height shows the medium view: donut, legend and trend side by side. */
  mediumWidth: 560,
  /** From this height (between 5 and 6 rows) a narrower card stacks the medium view vertically... */
  tallHeight: 580,
  /** ...as long as it is at least this wide. */
  tallMediumWidth: 420,
  /** From this width (with tallHeight) the large view applies. */
  largeWidth: 700
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const TEAM_ATTENDANCE_HYSTERESIS = 20;

export function classifyTeamAttendanceSize(width: number, height: number): TeamAttendanceView {
  const b = TEAM_ATTENDANCE_BREAKPOINTS;
  if (height < b.minHeight || width < b.miniWidth) return 'mini';
  if (height >= b.tallHeight) {
    if (width >= b.largeWidth) return 'large';
    return width >= b.tallMediumWidth ? 'medium' : 'small';
  }
  return width >= b.mediumWidth ? 'medium' : 'small';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it.
 * A zero size (not laid out yet, or hidden) keeps the previous view, or 'small'. */
export function resolveTeamAttendanceView(
  width: number,
  height: number,
  previous: TeamAttendanceView | null = null
): TeamAttendanceView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'small';
  const next = classifyTeamAttendanceSize(width, height);
  if (!previous || next === previous) return next;
  const h = TEAM_ATTENDANCE_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyTeamAttendanceSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}
