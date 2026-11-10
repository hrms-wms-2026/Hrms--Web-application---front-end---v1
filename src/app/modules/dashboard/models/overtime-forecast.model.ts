/**
 * Shared types of the two overtime forecast widgets (GET work/forecast/modules and work/forecast/employees,
 * design 2026-11-08). Rates are fractions (0.42 = 42%), hours are hours, minutes are minutes.
 */
/**
 * `raise_rate` reads "Overtime risk": the required rate is above the current one but within the tenant's realistic
 * limit (`maxTaskRate`, default 0.9). `overload`: the required rate is above that limit, so even at the limit the
 * work can't finish.
 */
export type ForecastStatus = 'on_track' | 'raise_rate' | 'overload' | 'no_history';

export const FORECAST_STATUSES: readonly ForecastStatus[] = [
  'on_track',
  'raise_rate',
  'overload',
  'no_history',
];

/** One week of the team's pooled task rate (the four weeks of the window); null without working time. */
export interface ForecastRateTrendPoint {
  readonly weekStart: string;
  readonly rate: number | null;
}

/** The hour figures every forecast row and total carries. */
export interface ForecastHours {
  readonly remainingHours: number;
  readonly capacityHours: number;
  readonly predictedHours: number;
  readonly overtimeHours: number;
}
