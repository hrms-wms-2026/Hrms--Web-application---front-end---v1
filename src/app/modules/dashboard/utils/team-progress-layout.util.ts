/** How the Team Progress card lays itself out at its current rendered size. Eight views (mini at
 * the 2x2 minimum, then the seven of the reference design); the detail dialog is one more. Components keep one fixed size in every view (the donut is always
 * TEAM_PROGRESS_DONUT_PX): a bigger card shows more detail, never bigger graphics. */
export type TeamProgressMode = 'mini' | 'xs' | 'small' | 'medium' | 'wide' | 'tall' | 'large' | 'maximum';

import { DASHBOARD_DONUT_LEGEND_ROW_PX, DASHBOARD_DONUT_PX, DASHBOARD_MINI_DONUT_PX } from './dashboard-donut.util';

/** The donut's diameter in every view that shows it (the shared dashboard size). */
export const TEAM_PROGRESS_DONUT_PX = DASHBOARD_DONUT_PX;

/**
 * Size thresholds in CSS pixels, measured on the card host. The dashboard grid uses 96px rows with a
 * 12px gap, so 3 rows = 312px, 4 = 420, 5 = 528, 6 = 636, 7 = 744 and 8 = 852; each height threshold
 * sits in the middle of a gap between two row counts (2 rows = 204px). Column widths depend on the screen (about 97px
 * per column at a 1440px viewport, about 140px at 1920px), so the width thresholds sit between the
 * column counts of the common screens rather than on a grid line.
 */
export const TEAM_PROGRESS_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) the donut doesn't fit under the title: the mini layout
   * shows the completion figure and one stacked bar. Narrow cards with more height keep the donut,
   * which fits from the 2-column width up. */
  miniHeight: 260,
  /** Below this width only the extra-small layout (donut over the completion figure) fits. */
  smallWidth: 370,
  /** From this width a short card shows the wide layout (donut beside bars, tiles under them) and a
   * mid-height card the medium layout (stacked bar and tinted tiles). */
  mediumWidth: 560,
  /** From this width a mid-height card shows the wide layout, and a tall card the large layout. */
  wideWidth: 780,
  /** From this width (and maximumHeight) the maximum layout applies. */
  maximumWidth: 1150,
  /** From this height (between 3 and 4 rows) the medium layout has room. */
  mediumHeight: 370,
  /** From this height (between 5 and 6 rows) the tall and large layouts have room. */
  tallHeight: 580,
  /** From this height (between 7 and 8 rows, with maximumWidth) the maximum layout applies. */
  maximumHeight: 800
} as const;

/** How far past a threshold the size must move before the mode changes back, so a card resized
 * slowly across a threshold doesn't flip between layouts on every frame. */
export const TEAM_PROGRESS_HYSTERESIS = 20;

/** The mode for a size, with no hysteresis. */
export function classifyTeamProgressSize(width: number, height: number): TeamProgressMode {
  const b = TEAM_PROGRESS_BREAKPOINTS;
  if (height < b.miniHeight) return 'mini';
  if (height >= b.tallHeight) {
    if (width < b.wideWidth) return 'tall';
    if (width < b.maximumWidth) return 'large';
    return height >= b.maximumHeight ? 'maximum' : 'large';
  }
  if (width < b.smallWidth) return 'xs';
  if (width < b.mediumWidth) return 'small';
  if (height < b.mediumHeight) return 'wide';
  return width < b.wideWidth ? 'medium' : 'wide';
}

/**
 * The mode for a rendered size. The previous mode is kept while the size is within
 * TEAM_PROGRESS_HYSTERESIS of a size that would still give it. A size of zero (not laid out yet, or
 * hidden) keeps the previous mode, or 'small' when there is none.
 */
export function resolveTeamProgressMode(
  width: number,
  height: number,
  previous: TeamProgressMode | null = null
): TeamProgressMode {
  if (!(width > 0) || !(height > 0)) return previous ?? 'small';
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

/** Height of one module / project / overdue list row (title line + thin bar). */
export const TEAM_PROGRESS_LIST_ROW_PX = 42;

/** What a list panel costs besides its rows: border, padding and heading. */
const PANEL_CHROME_PX = 44;

/** Gap between the card's sections. */
const GAP_PX = 12;

/** Card padding plus its title header: the host size minus this is the body. */
export const TEAM_PROGRESS_CARD_CHROME = { width: 40, height: 80 } as const;

/** Height of the weekly completion panel (heading, chart and footnote) in the views that show it. */
export const TEAM_PROGRESS_WEEKLY_PANEL_PX = 196;

/** Width from which the tall view puts the donut beside its status list instead of over it. */
export const TEAM_PROGRESS_TALL_SIDE_BY_SIDE_PX = 560;

const TILE_ROW_PX = 60 + GAP_PX;
/** small: one row of the 52px KPI cards. */
const KPI_ROW_PX = 52 + GAP_PX;
/** Height of the mini legend line. */
const MINI_LEGEND_ROW_PX = 22;
/** Body width from which a 2-row card puts the stacked status bar and its legend beside the
 * completion figure (from 4 columns at 1440px, 3 at 1920px). */
const MINI_INLINE_LEGEND_WIDTH_PX = 320;
/** Body width from which a 2-row card with the donut has room for the total beside it. */
const MINI_FIGURE_WIDTH_PX = DASHBOARD_MINI_DONUT_PX + 12 + 80;
const VIEW_DETAILS_PX = 36 + GAP_PX;
/** xs: the four-status legend under the donut (four shared legend rows). */
const XS_LEGEND_PX = GAP_PX + 4 * DASHBOARD_DONUT_LEGEND_ROW_PX;
/** xs: the completion figure and its caption under the legend. */
const XS_FIGURE_PX = GAP_PX + 50;

/** The optional sections a view shows at a size. Everything here has a fixed height, so a larger
 * card adds sections and list rows instead of growing what is already there. */
export interface TeamProgressPlan {
  /** mini only: 'inline' on a card stretched sideways - the stacked status bar and its legend sit
   * beside the figure; 'none' stacks the bar under the figure with no legend. */
  miniLegend: 'none' | 'inline';
  /** mini with the donut: whether the total fits beside it. xs: whether the completion figure fits under the legend. */
  miniFigure: boolean;
  /** xs only: the four-status legend right under the donut (the same place every widget puts its legend). */
  legend: boolean;
  /** xs / small / medium: rows of extra metric tiles. */
  tileRows: number;
  /** The full-width "View details" button at the bottom. */
  viewDetails: boolean;
  /** Rows each list panel (modules, projects, overdue tasks) shows; 0 hides the panels. */
  listRows: number;
  /** Extra list rows to use when the weekly completion panel is not shown (failed / unavailable). */
  weeklyFallbackRows: number;
  /** The planned-vs-worked band (tall / large / maximum, when the chart does not fit). */
  timeBand: boolean;
  /** The planned-vs-worked bucket chart (tall / large / maximum); it replaces the band. */
  timeChart: boolean;
  /** The unscheduled-work panel with its top 3 people (wide). */
  timeCallout: boolean;
  /** Workload ranking rows: 3 in medium, 5 in tall / large / maximum; 0 hides the panel. */
  workloadRows: number;
}

/** Fixed heights of the planned-vs-worked sections (they match team-progress-time's CSS). */
export const TEAM_PROGRESS_TIME_PX = {
  band: 84,
  /** The bucket chart: title row, plot and legend (2026-11-02 design match). */
  chart: 180,
  /** The unscheduled-work panel: a 18px title and three 20px people rows (6px padding); the most a 5-row wide card spares. */
  callout: 84,
  workloadRow: 40
} as const;

/** The list panels keep at least this many rows when a time section wants their space. */
const MIN_LIST_ROWS_KEPT = 2;

/** Fixed height of each view's always-shown content (body pixels, before optional sections). */
function baseHeight(mode: TeamProgressMode, bodyWidth: number): number {
  switch (mode) {
    // The donut, or (stretched sideways) the completion figure beside the stacked status bar.
    case 'mini':
      return DASHBOARD_MINI_DONUT_PX;
    // The donut; its legend and the completion figure follow when they fit.
    case 'xs':
      return TEAM_PROGRESS_DONUT_PX;
    // Donut with the completion line under it (4px gap + 16px line), beside the two-line legend (4 x 36px, shorter).
    case 'small':
      return TEAM_PROGRESS_DONUT_PX + 20;
    // Stacked bar, total line and the four status tiles.
    case 'medium':
      return 176;
    // Donut, its colour key and the weekly completion chart in one band (no metric tiles).
    case 'wide':
      return TEAM_PROGRESS_DONUT_PX;
    // Donut over (or beside) the status list, the weekly chart and the View details button.
    case 'tall':
      return (
        (bodyWidth >= TEAM_PROGRESS_TALL_SIDE_BY_SIDE_PX ? TEAM_PROGRESS_DONUT_PX + 22 : TEAM_PROGRESS_DONUT_PX + 22 + GAP_PX + 120) +
        GAP_PX +
        TEAM_PROGRESS_WEEKLY_PANEL_PX +
        VIEW_DETAILS_PX
      );
    // Donut + rows, tiles, then weekly chart beside the top members.
    case 'large':
      return TEAM_PROGRESS_DONUT_PX + GAP_PX + 60 + GAP_PX + TEAM_PROGRESS_WEEKLY_PANEL_PX;
    // Donut | rows | tiles band, then weekly chart beside the top members.
    case 'maximum':
      return TEAM_PROGRESS_DONUT_PX + 4 + GAP_PX + TEAM_PROGRESS_WEEKLY_PANEL_PX;
  }
}

function rowsFor(space: number): number {
  return Math.max(0, Math.min(20, Math.floor((space - PANEL_CHROME_PX) / TEAM_PROGRESS_LIST_ROW_PX)));
}

/** The sections and list rows a view shows at a host size. `rowPx` asks the small and medium views for one taller
 * row (a summary-cards row) in place of their tiles; every other view then plans no tile rows. */
export function planTeamProgressLayout(mode: TeamProgressMode, width: number, height: number, rowPx?: number): TeamProgressPlan {
  if (rowPx !== undefined && mode !== 'small' && mode !== 'medium') return { ...planTeamProgressLayout(mode, width, height), tileRows: 0 };
  const plan: TeamProgressPlan = {
    miniLegend: 'none', miniFigure: false, legend: false, tileRows: 0, viewDetails: false, listRows: 0, weeklyFallbackRows: 0,
    timeBand: false, timeChart: false, timeCallout: false, workloadRows: 0
  };
  if (!(width > 0) || !(height > 0)) return plan;
  const bodyWidth = width - TEAM_PROGRESS_CARD_CHROME.width;
  let rest = height - TEAM_PROGRESS_CARD_CHROME.height - baseHeight(mode, bodyWidth);

  switch (mode) {
    case 'mini':
      // The bar layout (figure + bar, 80px) is shorter than the donut, so it budgets on its own height.
      if (bodyWidth >= MINI_INLINE_LEGEND_WIDTH_PX && rest + DASHBOARD_MINI_DONUT_PX - 80 >= MINI_LEGEND_ROW_PX) plan.miniLegend = 'inline';
      else plan.miniFigure = bodyWidth >= MINI_FIGURE_WIDTH_PX;
      return plan;
    case 'xs':
      if (rest >= XS_LEGEND_PX) {
        plan.legend = true;
        rest -= XS_LEGEND_PX;
      }
      // Under the legend when it fits; a card too short for the legend still shows the figure under the donut.
      if (rest >= XS_FIGURE_PX) {
        plan.miniFigure = true;
        rest -= XS_FIGURE_PX;
      }
      if (plan.miniFigure && rest >= TILE_ROW_PX) {
        plan.tileRows = 1;
        rest -= TILE_ROW_PX;
      }
      plan.viewDetails = plan.tileRows > 0 && rest >= VIEW_DETAILS_PX;
      return plan;
    case 'small':
      if (rowPx !== undefined) {
        if (rest >= GAP_PX + rowPx) {
          plan.tileRows = 1;
          rest -= GAP_PX + rowPx;
        }
        plan.viewDetails = plan.tileRows === 1 && rest >= VIEW_DETAILS_PX;
        return plan;
      }
      while (plan.tileRows < 2 && rest >= KPI_ROW_PX) {
        plan.tileRows++;
        rest -= KPI_ROW_PX;
      }
      plan.viewDetails = plan.tileRows === 2 && rest >= VIEW_DETAILS_PX;
      return plan;
    case 'medium': {
      const tilePx = rowPx === undefined ? TILE_ROW_PX : GAP_PX + rowPx;
      if (rest >= tilePx) {
        plan.tileRows = 1;
        rest -= tilePx;
      }
      rest = reserveWorkload(plan, rest, 3);
      plan.listRows = rowsFor(rest - GAP_PX);
      plan.viewDetails = plan.listRows === 0 && plan.tileRows > 0 && rest >= VIEW_DETAILS_PX;
      return plan;
    }
    case 'wide':
    case 'large':
    case 'maximum':
      if (mode === 'wide') {
        if (canReserve(rest, TEAM_PROGRESS_TIME_PX.callout)) {
          plan.timeCallout = true;
          rest -= GAP_PX + TEAM_PROGRESS_TIME_PX.callout;
        }
      } else {
        rest = reserveBandAndWorkload(plan, rest);
      }
      plan.listRows = rowsFor(rest - GAP_PX);
      plan.weeklyFallbackRows = mode === 'wide' ? 0 : rowsFor(rest + TEAM_PROGRESS_WEEKLY_PANEL_PX) - plan.listRows;
      return plan;
    case 'tall':
      plan.viewDetails = true;
      rest = reserveBandAndWorkload(plan, rest);
      plan.listRows = rowsFor(rest - GAP_PX);
      plan.weeklyFallbackRows = rowsFor(rest + TEAM_PROGRESS_WEEKLY_PANEL_PX) - plan.listRows;
      return plan;
  }
}

/** A time section of `px` may take the space when it fits and the list panels keep MIN_LIST_ROWS_KEPT rows (or as many
 * as they had, when that was fewer). */
function canReserve(rest: number, px: number): boolean {
  if (rest < GAP_PX + px) return false;
  return rowsFor(rest - GAP_PX - px - GAP_PX) >= Math.min(MIN_LIST_ROWS_KEPT, rowsFor(rest - GAP_PX));
}

function reserveWorkload(plan: TeamProgressPlan, rest: number, rows: number): number {
  const px = PANEL_CHROME_PX + rows * TEAM_PROGRESS_TIME_PX.workloadRow;
  if (!canReserve(rest, px)) return rest;
  plan.workloadRows = rows;
  return rest - GAP_PX - px;
}

function reserveBandAndWorkload(plan: TeamProgressPlan, rest: number): number {
  if (canReserve(rest, TEAM_PROGRESS_TIME_PX.chart)) {
    plan.timeChart = true;
    rest -= GAP_PX + TEAM_PROGRESS_TIME_PX.chart;
  } else if (canReserve(rest, TEAM_PROGRESS_TIME_PX.band)) {
    plan.timeBand = true;
    rest -= GAP_PX + TEAM_PROGRESS_TIME_PX.band;
  }
  return reserveWorkload(plan, rest, 5);
}
