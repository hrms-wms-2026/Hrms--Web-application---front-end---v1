import { DASHBOARD_DONUT_LEGEND_ROW_PX, DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/**
 * The size ladder both overtime forecast cards use (the Work vs task hours ladder): mini (2 rows), xs (narrow
 * and tall: donut over the figure) and standard. A taller card adds KPI tiles, then its bar chart, then the
 * at-risk ranking. Each widget's own layout util wraps these with its names.
 */
export type ForecastView = 'mini' | 'xs' | 'standard';

export const FORECAST_BREAKPOINTS = { minHeight: 260, xsWidth: 330 } as const;
export const FORECAST_HYSTERESIS = 20;

export function classifyForecastSize(width: number, height: number): ForecastView {
  if (height < FORECAST_BREAKPOINTS.minHeight) return 'mini';
  return width < FORECAST_BREAKPOINTS.xsWidth ? 'xs' : 'standard';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it. */
export function resolveForecastView(
  width: number,
  height: number,
  previous: ForecastView | null = null,
): ForecastView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'standard';
  const next = classifyForecastSize(width, height);
  if (!previous || next === previous) return next;
  const h = FORECAST_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyForecastSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

/** Card padding plus its title header: the host size minus this is the body. */
export const FORECAST_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with (they match the cards' CSS). */
export const FORECAST_SECTION_PX = {
  gap: 12,
  xsFigure: 72,
  xsLegend: 3 * DASHBOARD_DONUT_LEGEND_ROW_PX,
  tileRow: 52,
  chart: 150,
  rankingHead: 24,
  rankingRow: 40,
} as const;

const TILES_ONE_ROW_WIDTH_PX = 400;
/** Body width from which the standard view lists the three slices beside the donut and figure. */
export const FORECAST_HERO_LEGEND_WIDTH_PX = 520;
/** Body width from which the bar chart sits in the hero row. */
const HERO_CHART_WIDTH_PX = 820;
const MIN_RANKING_ROWS = 3;
export const FORECAST_MAX_RANKING_ROWS = 10;

export interface ForecastPlan {
  heroChart: boolean;
  legend: boolean;
  figure: boolean;
  tiles: boolean;
  tileColumns: 2 | 4;
  chart: boolean;
  rankingRows: number;
}

export const EMPTY_FORECAST_PLAN: ForecastPlan = {
  heroChart: false,
  legend: false,
  figure: false,
  tiles: false,
  tileColumns: 4,
  chart: false,
  rankingRows: 0,
};

/** `rowPx` replaces the KPI tile row's height (one row, any width): a taller view's summary-cards row. */
export function planForecastLayout(
  view: ForecastView,
  width: number,
  height: number,
  rowPx?: number,
): ForecastPlan {
  if (view === 'mini' || !(width > 0) || !(height > 0)) return EMPTY_FORECAST_PLAN;
  const s = FORECAST_SECTION_PX;
  const bodyWidth = width - FORECAST_CARD_CHROME.width;
  let rest = height - FORECAST_CARD_CHROME.height - DASHBOARD_DONUT_PX;

  const tileColumns: 2 | 4 = bodyWidth >= TILES_ONE_ROW_WIDTH_PX ? 4 : 2;
  const tilesPx = s.gap + (rowPx ?? (tileColumns === 4 ? s.tileRow : s.tileRow * 2 + 8));
  const heroChart = view === 'standard' && bodyWidth >= HERO_CHART_WIDTH_PX;
  const plan: ForecastPlan = { ...EMPTY_FORECAST_PLAN, heroChart, tileColumns };
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

  if (!heroChart) {
    if (rest < s.gap + s.chart) return plan;
    plan.chart = true;
    rest -= s.gap + s.chart;
  }

  const rows = Math.floor((rest - s.gap - s.rankingHead) / s.rankingRow);
  if (rows >= MIN_RANKING_ROWS) plan.rankingRows = Math.min(rows, FORECAST_MAX_RANKING_ROWS);
  return plan;
}

export function sameForecastPlan(a: ForecastPlan, b: ForecastPlan): boolean {
  return (
    a.heroChart === b.heroChart &&
    a.legend === b.legend &&
    a.figure === b.figure &&
    a.tiles === b.tiles &&
    a.tileColumns === b.tileColumns &&
    a.chart === b.chart &&
    a.rankingRows === b.rankingRows
  );
}
