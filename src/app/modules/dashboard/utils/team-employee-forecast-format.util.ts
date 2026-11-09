import {
  EmployeeForecastItem,
  EmployeeForecastTotals,
} from '../models/team-employee-forecast.model';
import {
  FORECAST_COLORS,
  ForecastTileRow,
  forecastHoursText,
  forecastSlices,
  rateText,
} from './overtime-forecast-format.util';

/** The card's four tiles: Remaining, Predicted, Task rate, Won't fit. */
export function employeeForecastTiles(t: EmployeeForecastTotals): ForecastTileRow[] {
  return [
    {
      key: 'remaining',
      label: 'Remaining',
      value: forecastHoursText(t.remainingHours),
      title: `${forecastHoursText(t.remainingHours)} of open task estimates due by the deadlines`,
      color: FORECAST_COLORS.remaining,
    },
    {
      key: 'predicted',
      label: 'Predicted',
      value: forecastHoursText(t.predictedHours),
      title: `${forecastHoursText(t.predictedHours)} of task hours before the deadlines`,
      color: FORECAST_COLORS.covered,
    },
    {
      key: 'rate',
      label: 'Task rate',
      value: rateText(t.teamRate),
      title: `Team task rate ${rateText(t.teamRate)} over the last 4 weeks; needs ${rateText(t.requiredRate)}`,
      color: FORECAST_COLORS.raise,
    },
    {
      key: 'overtime',
      label: "Won't fit",
      value: forecastHoursText(t.overtimeHours),
      title: `${forecastHoursText(t.overtimeHours)} of task hours won't fit before the deadlines at today's rates`,
      color: FORECAST_COLORS.overtime,
    },
  ];
}

/** The people at overtime risk or in overload, overload first, then the most hours that won't fit. */
export function peopleAtRisk(items: readonly EmployeeForecastItem[]): EmployeeForecastItem[] {
  return items
    .filter((e) => e.status === 'raise_rate' || e.status === 'overload')
    .sort(
      (a, b) =>
        Number(b.status === 'overload') - Number(a.status === 'overload') ||
        b.overtimeHours - a.overtimeHours ||
        (b.requiredRate ?? 0) - (a.requiredRate ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

/** Plain words under the popup's pie. */
export function employeeForecastExplanation(t: EmployeeForecastTotals): string {
  if (t.people === 0) return 'No one in your team yet.';
  if (t.remainingHours <= 0)
    return 'Nobody has open estimated tasks due from today, so no one needs overtime.';
  if (t.teamRate === null)
    return `Nobody clocked working time in the last 4 weeks, so the forecast assumes every working hour becomes task hours. ${forecastHoursText(t.remainingHours)} of open tasks remain.`;
  const [covered, raise, overload] = forecastSlices(t, t.maxTaskRate).map((s) => s.value);
  const parts = [
    `Of ${forecastHoursText(t.remainingHours)} of open tasks due, each person's own task rate (team ${rateText(t.teamRate)}, last 4 weeks) completes about ${forecastHoursText(covered)} before their deadlines.`,
  ];
  if (raise > 0)
    parts.push(`Higher rates would cover another ${forecastHoursText(raise)} in normal hours.`);
  if (overload > 0)
    parts.push(
      `${forecastHoursText(overload)} don't fit even at the ${rateText(t.maxTaskRate)} task-rate limit: that is overload.`,
    );
  if (t.overtimeHours > 0)
    parts.push(
      `~${forecastHoursText(t.overtimeHours)} won't fit at today's rates, across ${t.overload + t.raiseRate} people.`,
    );
  else parts.push("Everything fits at today's rates.");
  return parts.join(' ');
}
