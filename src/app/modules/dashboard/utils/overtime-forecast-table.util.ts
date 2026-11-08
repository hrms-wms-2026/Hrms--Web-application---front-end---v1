import { SelectOption } from '../../../shared/ui/select/select.component';
import { FORECAST_STATUSES, ForecastStatus } from '../models/overtime-forecast.model';
import { FORECAST_STATUS_META } from './overtime-forecast-format.util';

/** The popup tables' status filter: everything, then each status. */
export const FORECAST_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  ...FORECAST_STATUSES.map((s) => ({ value: s, label: FORECAST_STATUS_META[s].label })),
];

/** A status filter value, null for "all" or anything unknown. */
export function parseForecastStatus(value: string): ForecastStatus | null {
  return (FORECAST_STATUSES as readonly string[]).includes(value) ? (value as ForecastStatus) : null;
}

/** How long the table waits after the last key before it searches. */
export const FORECAST_SEARCH_DEBOUNCE_MS = 250;

/** The server sorts each key one way: names and deadlines ascending, the rate lowest first, the rest highest first. */
export function forecastSortDirection(sort: string): 'ascending' | 'descending' {
  return sort === 'name' || sort === 'endDate' || sort === 'rate' ? 'ascending' : 'descending';
}
