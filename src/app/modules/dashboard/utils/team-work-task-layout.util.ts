import { DASHBOARD_DONUT_LEGEND_ROW_PX, DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/** How the Work vs task hours card lays itself out at its rendered size. The detail dialog is the popup. */
export type TeamWorkTaskView = 'mini' | 'xs' | 'standard';

/**
 * Size thresholds in CSS pixels, measured on the card host (the same ladder as Team attendance). The grid uses 96px
 * rows with a 12px gap (2 rows = 204px, 3 = 312, 4 = 420, 5 = 528, 6 = 636).
 */
export const TEAM_WORK_TASK_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) only the mini view fits. */
  minHeight: 260,
  /** Below this width a card with height shows the xs view: the donut over the figure. */
  xsWidth: 330,
  /** From this width a 2-row card swaps the donut for a stacked bar and legend beside the figure. */
  miniBarWidth: 360,
  /** From this width a 2-row card with the donut has room for task-of-worked hours beside it. */
  miniFigureWidth: 256,
} as const;

export const TEAM_WORK_TASK_HYSTERESIS = 20;

export function classifyTeamWorkTaskSize(width: number, height: number): TeamWorkTaskView {
  const b = TEAM_WORK_TASK_BREAKPOINTS;
  if (height < b.minHeight) return 'mini';
  return width < b.xsWidth ? 'xs' : 'standard';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it. */
export function resolveTeamWorkTaskView(
  width: number,
  height: number,
  previous: TeamWorkTaskView | null = null,
): TeamWorkTaskView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'standard';
  const next = classifyTeamWorkTaskSize(width, height);
  if (!previous || next === previous) return next;
  const h = TEAM_WORK_TASK_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyTeamWorkTaskSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

/** Card padding plus its title header: the host size minus this is the body. */
export const TEAM_WORK_TASK_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with (they match the card's CSS). */
export const TEAM_WORK_TASK_SECTION_PX = {
  gap: 12,
  range: 24,
  xsFigure: 72,
  /** The xs legend under the donut: three legend rows. */
  xsLegend: 3 * DASHBOARD_DONUT_LEGEND_ROW_PX,
  tileRow: 52,
  trend: 150,
  rankingHead: 24,
  rankingRow: 40,
} as const;

const TILES_ONE_ROW_WIDTH_PX = 400;
/** Body width from which the standard view lists the three slices beside the donut and figure. */
export const TEAM_WORK_TASK_HERO_LEGEND_WIDTH_PX = 520;
/** Body width from which the trend chart sits in the hero row. */
const HERO_TREND_WIDTH_PX = 820;
const MIN_RANKING_ROWS = 3;
export const TEAM_WORK_TASK_MAX_RANKING_ROWS = 10;

/** The sections a view adds below the donut: KPI tiles, then the daily chart, then the employee ranking. */
export interface TeamWorkTaskPlan {
  heroTrend: boolean;
  legend: boolean;
  figure: boolean;
  tiles: boolean;
  tileColumns: 2 | 4;
  trend: boolean;
  rankingRows: number;
}

export const EMPTY_TEAM_WORK_TASK_PLAN: TeamWorkTaskPlan = {
  heroTrend: false,
  legend: false,
  figure: false,
  tiles: false,
  tileColumns: 4,
  trend: false,
  rankingRows: 0,
};

export function planTeamWorkTaskLayout(
  view: TeamWorkTaskView,
  width: number,
  height: number,
): TeamWorkTaskPlan {
  if (view === 'mini' || !(width > 0) || !(height > 0)) return EMPTY_TEAM_WORK_TASK_PLAN;
  const s = TEAM_WORK_TASK_SECTION_PX;
  const bodyWidth = width - TEAM_WORK_TASK_CARD_CHROME.width;
  const base = view === 'xs' ? DASHBOARD_DONUT_PX : s.range + s.gap + DASHBOARD_DONUT_PX;
  let rest = height - TEAM_WORK_TASK_CARD_CHROME.height - base;

  const tileColumns: 2 | 4 = bodyWidth >= TILES_ONE_ROW_WIDTH_PX ? 4 : 2;
  const tilesPx = s.gap + (tileColumns === 4 ? s.tileRow : s.tileRow * 2 + 8);
  const heroTrend = view === 'standard' && bodyWidth >= HERO_TREND_WIDTH_PX;
  const plan: TeamWorkTaskPlan = { ...EMPTY_TEAM_WORK_TASK_PLAN, heroTrend, tileColumns };
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

  if (!heroTrend) {
    if (rest < s.gap + s.trend) return plan;
    plan.trend = true;
    rest -= s.gap + s.trend;
  }

  const rows = Math.floor((rest - s.gap - s.rankingHead) / s.rankingRow);
  if (rows >= MIN_RANKING_ROWS) plan.rankingRows = Math.min(rows, TEAM_WORK_TASK_MAX_RANKING_ROWS);
  return plan;
}
