import { ForecastPlan, ForecastView } from './overtime-forecast-layout.util';

/**
 * The Employee overtime forecast card's layout: the shared forecast ladder (mini / xs / standard; tiles, then the
 * rate-vs-required chart, then the people-at-risk ranking), plus which summary cards a planned view already shows.
 */
export {
  EMPTY_FORECAST_PLAN as EMPTY_EMPLOYEE_FORECAST_PLAN,
  FORECAST_CARD_CHROME as EMPLOYEE_FORECAST_CARD_CHROME,
  FORECAST_HERO_LEGEND_WIDTH_PX as EMPLOYEE_FORECAST_HERO_LEGEND_WIDTH_PX,
  planForecastLayout as planEmployeeForecastLayout,
  resolveForecastView as resolveEmployeeForecastView,
} from './overtime-forecast-layout.util';
export type {
  ForecastPlan as EmployeeForecastPlan,
  ForecastView as EmployeeForecastView,
} from './overtime-forecast-layout.util';

/** The summary cards whose popup section a taller view already shows as its own section. */
export function shownEmployeeForecastCards(
  view: ForecastView,
  plan: ForecastPlan,
): ReadonlySet<string> {
  const shown = new Set<string>();
  if (view === 'standard' || plan.figure) shown.add('ef-rate');
  if (plan.chart || plan.heroChart) shown.add('ef-overtime');
  if (plan.rankingRows > 0) shown.add('ef-risk');
  return shown;
}
