import { DASHBOARD_DONUT_LEGEND_ROW_PX, DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/** How the Team attendance card lays itself out at its rendered size. The detail dialog is the popup. */
export type TeamAttendanceView = 'mini' | 'xs' | 'standard';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 3 = 312, 4 = 420, 5 = 528, 6 = 636), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const TEAM_ATTENDANCE_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) only the mini view fits: the donut with today's rate in it,
   * or on a wide card the rate beside a stacked bar. */
  minHeight: 260,
  /** Below this width there is no room for the donut beside today's rate, so a card with height
   * shows the xs view: the donut over the rate, like Team Progress at the same size. */
  xsWidth: 330,
  /** From this width a 2-row (mini) card swaps the donut for a stacked bar and legend beside the rate. */
  miniBarWidth: 360,
  /** From this width a 2-row card with the donut has room for attended-of-eligible beside it. */
  miniFigureWidth: 256
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const TEAM_ATTENDANCE_HYSTERESIS = 20;

export function classifyTeamAttendanceSize(width: number, height: number): TeamAttendanceView {
  const b = TEAM_ATTENDANCE_BREAKPOINTS;
  if (height < b.minHeight) return 'mini';
  return width < b.xsWidth ? 'xs' : 'standard';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it.
 * A zero size (not laid out yet, or hidden) keeps the previous view, or 'standard'. */
export function resolveTeamAttendanceView(
  width: number,
  height: number,
  previous: TeamAttendanceView | null = null
): TeamAttendanceView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'standard';
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

/** Card padding plus its title header: the host size minus this is the body. */
export const TEAM_ATTENDANCE_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with (they match the card's CSS). */
export const TEAM_ATTENDANCE_SECTION_PX = {
  gap: 12,
  /** The ‹ range › row of the standard view. */
  range: 24,
  /** The rate, caption and change under the legend (xs). */
  xsFigure: 72,
  /** The xs legend under the donut: four shared legend rows. */
  xsLegend: 4 * DASHBOARD_DONUT_LEGEND_ROW_PX,
  /** One row of status tiles. */
  tileRow: 52,
  /** The trend panel: title and chart. */
  trend: 150,
  /** The ranking panel's heading. */
  rankingHead: 24,
  /** One ranked employee. */
  rankingRow: 40
} as const;

/** Body width from which the status tiles sit on one row (else two by two). */
const TILES_ONE_ROW_WIDTH_PX = 400;
/** Body width from which the standard view lists today's statuses beside the donut and rate. */
export const TEAM_ATTENDANCE_HERO_LEGEND_WIDTH_PX = 520;
/** Body width from which the trend chart sits in the same row, between the rate and the legend. */
const HERO_TREND_WIDTH_PX = 820;
/** The fewest ranked employees worth a panel. */
const MIN_RANKING_ROWS = 3;
/** The most ranked employees the card shows (the popup has the full list). */
export const TEAM_ATTENDANCE_MAX_RANKING_ROWS = 10;

/** The sections a view adds below the donut at a size. Each needs the one before it, so a taller card
 * shows the status tiles first, then the trend chart, then the employee ranking; the donut never moves. */
export interface TeamAttendancePlan {
  /** standard on a wide card: the trend chart sits beside the donut, rate and legend instead of below. */
  heroTrend: boolean;
  /** xs: the status legend right under the donut (where every widget puts its legend). */
  legend: boolean;
  /** xs: today's rate, caption and change under the legend (or under the donut when the legend doesn't fit). */
  figure: boolean;
  tiles: boolean;
  tileColumns: 2 | 4;
  trend: boolean;
  rankingRows: number;
}

export const EMPTY_TEAM_ATTENDANCE_PLAN: TeamAttendancePlan = { heroTrend: false, legend: false, figure: false, tiles: false, tileColumns: 4, trend: false, rankingRows: 0 };

export function planTeamAttendanceLayout(view: TeamAttendanceView, width: number, height: number): TeamAttendancePlan {
  if (view === 'mini' || !(width > 0) || !(height > 0)) return EMPTY_TEAM_ATTENDANCE_PLAN;
  const s = TEAM_ATTENDANCE_SECTION_PX;
  const bodyWidth = width - TEAM_ATTENDANCE_CARD_CHROME.width;
  // xs: the donut, then its legend (it stands in for the status tiles) like every widget at this size.
  const base = view === 'xs' ? DASHBOARD_DONUT_PX : s.range + s.gap + DASHBOARD_DONUT_PX;
  let rest = height - TEAM_ATTENDANCE_CARD_CHROME.height - base;

  const tileColumns: 2 | 4 = bodyWidth >= TILES_ONE_ROW_WIDTH_PX ? 4 : 2;
  const tilesPx = s.gap + (tileColumns === 4 ? s.tileRow : s.tileRow * 2 + 8);
  const heroTrend = view === 'standard' && bodyWidth >= HERO_TREND_WIDTH_PX;
  const plan: TeamAttendancePlan = { heroTrend, legend: false, figure: false, tiles: false, tileColumns, trend: false, rankingRows: 0 };
  if (view === 'xs') {
    if (rest >= s.gap + s.xsLegend) {
      plan.legend = true;
      rest -= s.gap + s.xsLegend;
    }
    if (rest < s.gap + s.xsFigure) return plan;
    plan.figure = true;
    rest -= s.gap + s.xsFigure;
  } else {
    if (rest < tilesPx) return plan;
    plan.tiles = true;
    rest -= tilesPx;
  }

  // Beside the donut the trend costs no height; otherwise it comes before the ranking.
  if (!heroTrend) {
    if (rest < s.gap + s.trend) return plan;
    plan.trend = true;
    rest -= s.gap + s.trend;
  }

  const rows = Math.floor((rest - s.gap - s.rankingHead) / s.rankingRow);
  if (rows >= MIN_RANKING_ROWS) plan.rankingRows = Math.min(rows, TEAM_ATTENDANCE_MAX_RANKING_ROWS);
  return plan;
}
