import { EmployeeForecastItem, EmployeeForecastTotals } from '../models/team-employee-forecast.model';
import { FORECAST_COLORS, ForecastTileRow, forecastHoursText, forecastSlices, rateText } from './overtime-forecast-format.util';

/** The card's four tiles: Remaining, Predicted, Task rate, Overtime h. */
export function employeeForecastTiles(t: EmployeeForecastTotals): ForecastTileRow[] {
  return [
    { key: 'remaining', label: 'Remaining', value: forecastHoursText(t.remainingHours), title: `${forecastHoursText(t.remainingHours)} of open task estimates due by the deadlines`, color: FORECAST_COLORS.remaining },
    { key: 'predicted', label: 'Predicted', value: forecastHoursText(t.predictedHours), title: `${forecastHoursText(t.predictedHours)} of task hours before the deadlines`, color: FORECAST_COLORS.covered },
    { key: 'rate', label: 'Task rate', value: rateText(t.teamRate), title: `Team task rate ${rateText(t.teamRate)} over the last 4 weeks; needs ${rateText(t.requiredRate)}`, color: FORECAST_COLORS.raise },
    { key: 'overtime', label: 'Overtime h', value: forecastHoursText(t.overtimeHours), title: `${forecastHoursText(t.overtimeHours)} of overtime at the current rates`, color: FORECAST_COLORS.overtime },
  ];
}

/** The people who need a higher rate or overtime, most overtime first. */
export function peopleAtRisk(items: readonly EmployeeForecastItem[]): EmployeeForecastItem[] {
  return items
    .filter((e) => e.status === 'raise_rate' || e.status === 'overtime')
    .sort((a, b) => b.overtimeHours - a.overtimeHours || (b.requiredRate ?? 0) - (a.requiredRate ?? 0) || a.name.localeCompare(b.name));
}

/** Plain words under the popup's pie. */
export function employeeForecastExplanation(t: EmployeeForecastTotals): string {
  if (t.people === 0) return 'No one in your team yet.';
  if (t.remainingHours <= 0) return 'Nobody has open estimated tasks due from today, so no one needs overtime.';
  if (t.teamRate === null)
    return `Nobody clocked working time in the last 4 weeks, so the forecast assumes every working hour becomes task hours. ${forecastHoursText(t.remainingHours)} of open tasks remain.`;
  const [covered, raise, overtime] = forecastSlices(t).map((s) => s.value);
  const parts = [
    `Of ${forecastHoursText(t.remainingHours)} of open tasks due, each person's own task rate (team ${rateText(t.teamRate)}, last 4 weeks) completes about ${forecastHoursText(covered)} before their deadlines.`,
  ];
  if (raise > 0) parts.push(`Higher rates would cover another ${forecastHoursText(raise)} in normal hours.`);
  if (overtime > 0) parts.push(`${forecastHoursText(overtime)} do not fit in normal working hours even at 100%.`);
  if (t.overtimeHours > 0) parts.push(`At today's rates that is ~${forecastHoursText(t.overtimeHours)} of overtime across ${t.overtime + t.raiseRate} people.`);
  else parts.push('No overtime is needed at today\'s rates.');
  return parts.join(' ');
}
