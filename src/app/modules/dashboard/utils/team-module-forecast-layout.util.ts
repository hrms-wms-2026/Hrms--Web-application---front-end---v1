import { ForecastPlan, ForecastView } from './overtime-forecast-layout.util';

/**
 * The Module overtime forecast card's layout: the shared forecast ladder (mini / xs / standard; tiles, then the
 * project chart, then the modules-at-risk ranking), plus which summary cards a planned view already shows.
 */
export {
  EMPTY_FORECAST_PLAN as EMPTY_MODULE_FORECAST_PLAN,
  FORECAST_CARD_CHROME as MODULE_FORECAST_CARD_CHROME,
  FORECAST_HERO_LEGEND_WIDTH_PX as MODULE_FORECAST_HERO_LEGEND_WIDTH_PX,
  planForecastLayout as planModuleForecastLayout,
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
