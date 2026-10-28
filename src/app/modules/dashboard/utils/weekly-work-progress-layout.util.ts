import { DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/** How the Weekly Work Progress card lays itself out at its rendered size. The detail dialog is the popup. */
export type WeeklyProgressView = 'mini' | 'mini-wide' | 'xs' | 'standard';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 3 = 312, 4 = 420, 5 = 528, 6 = 636), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const WEEKLY_PROGRESS_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) only a one-row view fits. */
  minHeight: 260,
  /** From this width a 2-row card shows the figure beside this week / last week bars instead of the donut. */
  miniWideWidth: 360,
  /** From this width a 2-row card also has room for the Expected / Scheduled / Worked tiles. */
  miniTilesWidth: 640,
  /** Below this width a taller card stacks: donut on top, tiles under it. */
  xsWidth: 330,
  /** Body width from which the four tiles sit on one row beside the donut (else two by two under it). */
  tilesOneRowBodyWidth: 520
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const WEEKLY_PROGRESS_HYSTERESIS = 20;

/** Card padding plus its title header: the host size minus this is the body. */
export const WEEKLY_PROGRESS_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with, measured in the browser on the rendered card (2026-10-29). */
export const WEEKLY_PROGRESS_SECTION_PX = {
  gap: 12,
  /** The change-vs-last-week line under the donut, with its gap. */
  delta: 22,
  /** The gap between stacked tiles. */
  tileGap: 8,
  /** One stacked tile in the xs view. */
  stackedTile: 52,
  /** The Daily Work vs Schedule section: rule, title, legend and chart. */
  chart: 186,
  /** The Weekly Comparison section. */
  comparison: 116
} as const;

/** Body width from which a narrow standard card lists the tiles as compact rows beside the donut. */
const SIDE_TILES_BODY_WIDTH = 300;

export interface WeeklyProgressSections {
  /** mini-wide: Expected / Scheduled / Worked tiles beside the bars. */
  miniTiles: boolean;
  /** xs: how many of Expected, Scheduled, Worked, Remaining stack under the donut. */
  stackedTiles: number;
  /** standard: the KPI tiles on one row beside the donut. */
  tilesOneRow: boolean;
  /** standard, narrower: how many tiles are listed as compact rows beside the donut (they never go under it). */
  sideTiles: number;
  chart: boolean;
  comparison: boolean;
}

const MAX_TILES = 4;

export function classifyWeeklyProgressSize(width: number, height: number): WeeklyProgressView {
  const b = WEEKLY_PROGRESS_BREAKPOINTS;
  if (height < b.minHeight) return width < b.miniWideWidth ? 'mini' : 'mini-wide';
  return width < b.xsWidth ? 'xs' : 'standard';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it.
 * A zero size (not laid out yet, or hidden) keeps the previous view, or 'standard'. */
export function resolveWeeklyProgressView(
  width: number,
  height: number,
  previous: WeeklyProgressView | null = null
): WeeklyProgressView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'standard';
  const next = classifyWeeklyProgressSize(width, height);
  if (!previous || next === previous) return next;
  const h = WEEKLY_PROGRESS_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyWeeklyProgressSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

/** What fits in the card body (host size minus WEEKLY_PROGRESS_CARD_CHROME) for a view. The donut never resizes;
 * a bigger card gets more sections, in this order: tiles, Daily Work vs Schedule, Weekly Comparison. */
export function planWeeklyProgressSections(
  view: WeeklyProgressView,
  bodyWidth: number,
  bodyHeight: number
): WeeklyProgressSections {
  const s = WEEKLY_PROGRESS_SECTION_PX;
  const none: WeeklyProgressSections = {
    miniTiles: false, stackedTiles: 0, tilesOneRow: false, sideTiles: 0, chart: false, comparison: false
  };
  const hero = DASHBOARD_DONUT_PX + s.delta;

  if (view === 'mini') return none;
  if (view === 'mini-wide') {
    return { ...none, miniTiles: bodyWidth >= WEEKLY_PROGRESS_BREAKPOINTS.miniTilesWidth - WEEKLY_PROGRESS_CARD_CHROME.width };
  }
  if (view === 'xs') {
    const fit = Math.floor((bodyHeight - hero - s.gap + s.tileGap) / (s.stackedTile + s.tileGap));
    return { ...none, stackedTiles: Math.max(0, Math.min(MAX_TILES, fit)) };
  }

  // The tiles always sit beside the donut (one KPI row, or compact rows when narrower), so the top block is the hero's
  // height; the chart and then the comparison are added only once the body is tall enough for them.
  const tilesOneRow = bodyWidth >= WEEKLY_PROGRESS_BREAKPOINTS.tilesOneRowBodyWidth;
  const sideTiles = !tilesOneRow && bodyWidth >= SIDE_TILES_BODY_WIDTH ? MAX_TILES : 0;
  const chart = bodyHeight >= hero + s.gap + s.chart;
  const comparison = chart && bodyHeight >= hero + 2 * s.gap + s.chart + s.comparison;
  return { ...none, tilesOneRow, sideTiles, chart, comparison };
}
