import {
  ModuleForecastItem,
  ModuleForecastTotals,
} from '../models/team-module-forecast.model';
import {
  FORECAST_COLORS,
  ForecastTileRow,
  forecastHoursText,
  forecastSlices,
  overloadRateText,
  rateText,
  rateVsRequiredShort,
  rateVsRequiredText,
} from './overtime-forecast-format.util';

/** The card's four tiles: Allocated, Predicted, Task rate, Won't fit. */
export function moduleForecastTiles(t: ModuleForecastTotals): ForecastTileRow[] {
  return [
    {
      key: 'allocated',
      label: 'Allocated',
      value: forecastHoursText(t.allocatedHours),
      title: `${forecastHoursText(t.allocatedHours)} allocated, ${forecastHoursText(t.remainingHours)} still to do`,
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
      title: `Task rate ${rateText(t.teamRate)} over the last 4 weeks; needs ${rateText(t.requiredRate)}`,
      color: FORECAST_COLORS.raise,
    },
    {
      key: 'overtime',
      label: "Won't fit",
      value: forecastHoursText(t.overtimeHours),
      title: `${forecastHoursText(t.overtimeHours)} of task hours won't fit before the deadlines at today's rate`,
      color: FORECAST_COLORS.overtime,
    },
  ];
}

/** The modules at overtime risk or in overload, overload first, then the most hours that won't fit. */
export function modulesAtRisk(items: readonly ModuleForecastItem[]): ModuleForecastItem[] {
  return items
    .filter((m) => m.status === 'raise_rate' || m.status === 'overload')
    .sort(
      (a, b) =>
        Number(b.status === 'overload') - Number(a.status === 'overload') ||
        b.overtimeHours - a.overtimeHours ||
        (b.requiredRate ?? 0) - (a.requiredRate ?? 0) ||
        a.title.localeCompare(b.title),
    );
}

/** A module's own task-rate limit (its legal entity's), else the response's. */
export function moduleRateLimit(m: ModuleForecastItem, totals: ModuleForecastTotals): number {
  return m.maxTaskRate ?? totals.maxTaskRate;
}

/** A module row's rate text: "42% → needs 45%"; in overload with its own limit, "42% → needs 96%, limit 90%". */
export function moduleRowRateText(
  m: ModuleForecastItem,
  totals: ModuleForecastTotals,
  short = false,
): string {
  if (m.status === 'overload')
    return overloadRateText(m.conversionRate, m.requiredRate, moduleRateLimit(m, totals), short);
  return short
    ? rateVsRequiredShort(m.conversionRate, m.requiredRate)
    : rateVsRequiredText(m.conversionRate, m.requiredRate);
}

/** Plain words under the popup's pie. */
export function moduleForecastExplanation(t: ModuleForecastTotals): string {
  if (t.modules === 0) return 'No open milestones with a deadline ahead.';
  if (t.remainingHours <= 0)
    return `All ${t.modules} milestones have their allocated hours completed.`;
  if (t.teamRate === null)
    return `Nobody on these milestones clocked working time in the last 4 weeks, so the forecast assumes every working hour becomes task hours. ${forecastHoursText(t.remainingHours)} remain.`;
  const [covered, raise, overload] = forecastSlices(t, t.maxTaskRate).map((s) => s.value);
  const parts = [
    `Of ${forecastHoursText(t.remainingHours)} still to do, the team's ${rateText(t.teamRate)} task rate (last 4 weeks) completes about ${forecastHoursText(covered)} before the deadlines.`,
  ];
  if (raise > 0)
    parts.push(
      `A higher rate (${rateText(t.requiredRate)} is needed) would cover another ${forecastHoursText(raise)} in normal hours.`,
    );
  if (overload > 0)
    parts.push(
      `${forecastHoursText(overload)} don't fit even at the ${rateText(t.maxTaskRate)} task-rate limit: that is overload.`,
    );
  if (t.overtimeHours > 0)
    parts.push(`~${forecastHoursText(t.overtimeHours)} won't fit at today's rate.`);
  else parts.push("Everything fits at today's rate.");
  return parts.join(' ');
}
