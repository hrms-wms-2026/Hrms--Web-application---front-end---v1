import {
  FORECAST_CARD_CHROME,
  ForecastPlan,
  ForecastView,
  planForecastLayout,
} from './overtime-forecast-layout.util';

/**
 * The Module overtime forecast card's layout: the shared forecast ladder (mini / xs / standard; tiles, then the
 * project chart, then the modules-at-risk ranking), plus which summary cards a planned view already shows.
 */
export {
  EMPTY_FORECAST_PLAN as EMPTY_MODULE_FORECAST_PLAN,
  FORECAST_CARD_CHROME as MODULE_FORECAST_CARD_CHROME,
  FORECAST_HERO_LEGEND_WIDTH_PX as MODULE_FORECAST_HERO_LEGEND_WIDTH_PX,
  resolveForecastView as resolveModuleForecastView,
} from './overtime-forecast-layout.util';
export type {
  ForecastPlan as ModuleForecastPlan,
  ForecastView as ModuleForecastView,
} from './overtime-forecast-layout.util';

/** The summary cards whose popup section a taller view already shows as its own section. */
export function shownModuleForecastCards(
  view: ForecastView,
  plan: ForecastPlan,
): ReadonlySet<string> {
  const shown = new Set<string>();
  if (view === 'standard' || plan.figure) shown.add('mf-rate');
  if (plan.chart || plan.heroChart) shown.add('mf-overtime');
  if (plan.rankingRows > 0) shown.add('mf-risk');
  return shown;
}

/** Body width under which the card's project chart is narrow (title over its figure, no axis). */
export const MODULE_FORECAST_NARROW_BODY_PX = 360;
/**
 * Extra height a narrow chart panel needs on top of the shared 150px: its headline takes two lines and the
 * "+N more" line sits under the plot, which left the bars about 40px tall.
 */
export const MODULE_FORECAST_NARROW_CHART_EXTRA_PX = 56;
/** In xs the hero caption ("Needs 46% task rate · now 30%") wraps to a second line the shared 72px doesn't hold. */
export const MODULE_FORECAST_XS_FIGURE_EXTRA_PX = 18;

/**
 * The shared forecast plan, with this card's own extra heights: the xs figure's second caption line, and a taller
 * chart panel in a narrow card. Without them the sections overflowed their budget and the ranking was cut off.
 * The narrow chart is added only when its full height fits; the ranking then gets what is left.
 */
export function planModuleForecastLayout(
  view: ForecastView,
  width: number,
  height: number,
  rowPx?: number,
  rankingItems?: number,
): ForecastPlan {
  const plan = (h: number) => planForecastLayout(view, width, h, rowPx, rankingItems);
  const xsExtra = view === 'xs' ? MODULE_FORECAST_XS_FIGURE_EXTRA_PX : 0;
  let base = plan(height - xsExtra);
  // A short xs card keeps its figure even without room for the caption's second line: nothing sits under it.
  if (xsExtra > 0 && !base.figure) base = plan(height);
  const narrow = width - FORECAST_CARD_CHROME.width < MODULE_FORECAST_NARROW_BODY_PX;
  if (!narrow || !base.chart) return base;
  const extra = MODULE_FORECAST_NARROW_CHART_EXTRA_PX;
  const tall = plan(height - xsExtra - extra);
  return tall.chart ? { ...tall, chartPx: tall.chartPx + extra } : tall;
}
