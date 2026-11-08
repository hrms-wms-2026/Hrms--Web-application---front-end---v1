import { ModuleForecastItem, ModuleForecastTotals } from '../models/team-module-forecast.model';
import { FORECAST_COLORS, forecastHoursText, forecastSlices, rateText } from './overtime-forecast-format.util';

/** One of the card's KPI tiles. */
export interface ForecastTileRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** The exact figure, as the tile's tooltip. */
  readonly title: string;
  readonly color: string;
}

/** The card's four tiles: Allocated, Predicted, Task rate, Overtime h. */
export function moduleForecastTiles(t: ModuleForecastTotals): ForecastTileRow[] {
  return [
    { key: 'allocated', label: 'Allocated', value: forecastHoursText(t.allocatedHours), title: `${forecastHoursText(t.allocatedHours)} allocated, ${forecastHoursText(t.remainingHours)} still to do`, color: FORECAST_COLORS.remaining },
    { key: 'predicted', label: 'Predicted', value: forecastHoursText(t.predictedHours), title: `${forecastHoursText(t.predictedHours)} of task hours before the deadlines`, color: FORECAST_COLORS.covered },
    { key: 'rate', label: 'Task rate', value: rateText(t.teamRate), title: `Task rate ${rateText(t.teamRate)} over the last 4 weeks; needs ${rateText(t.requiredRate)}`, color: FORECAST_COLORS.raise },
    { key: 'overtime', label: 'Overtime h', value: forecastHoursText(t.overtimeHours), title: `${forecastHoursText(t.overtimeHours)} of overtime at the current rate`, color: FORECAST_COLORS.overtime },
  ];
}

/** The modules that need a higher rate or overtime, most overtime first. */
export function modulesAtRisk(items: readonly ModuleForecastItem[]): ModuleForecastItem[] {
  return items
    .filter((m) => m.status === 'raise_rate' || m.status === 'overtime')
    .sort((a, b) => b.overtimeHours - a.overtimeHours || (b.requiredRate ?? 0) - (a.requiredRate ?? 0) || a.title.localeCompare(b.title));
}

/** Plain words under the popup's pie. */
export function moduleForecastExplanation(t: ModuleForecastTotals): string {
  if (t.modules === 0) return 'No open modules with a deadline ahead.';
  if (t.remainingHours <= 0) return `All ${t.modules} modules have their allocated hours completed.`;
  if (t.teamRate === null)
    return `Nobody on these modules clocked working time in the last 4 weeks, so the forecast assumes every working hour becomes task hours. ${forecastHoursText(t.remainingHours)} remain.`;
  const [covered, raise, overtime] = forecastSlices(t).map((s) => s.value);
  const parts = [
    `Of ${forecastHoursText(t.remainingHours)} still to do, the team's ${rateText(t.teamRate)} task rate (last 4 weeks) completes about ${forecastHoursText(covered)} before the deadlines.`,
  ];
  if (raise > 0) parts.push(`A higher rate (${rateText(t.requiredRate)} is needed) would cover another ${forecastHoursText(raise)} in normal hours.`);
  if (overtime > 0) parts.push(`${forecastHoursText(overtime)} do not fit in normal working hours even at 100%.`);
  if (t.overtimeHours > 0) parts.push(`At today's rate that is ~${forecastHoursText(t.overtimeHours)} of overtime.`);
  else parts.push('No overtime is needed at today\'s rate.');
  return parts.join(' ');
}
