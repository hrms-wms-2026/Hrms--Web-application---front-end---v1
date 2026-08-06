import { SelectOption } from '../../../shared/ui/select/select.component';

/** ISO-8601 weekday numbering (Monday=1 ... Sunday=7), matching the backend's
 * firstDayOfWeek/standardWorkingDays InclusiveBetween(1,7) range. The backend
 * does not itself document which integer maps to which day - this is the
 * ISO-8601 convention, called out in the Part 2C report as an assumption. */
export const WEEKDAY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
];

export const FIRST_DAY_OF_WEEK_OPTIONS: readonly SelectOption[] = WEEKDAY_OPTIONS.map((d) => ({
  value: String(d.value),
  label: d.label
}));

export const FINANCIAL_YEAR_MONTH_OPTIONS: readonly SelectOption[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, i) => ({ value: String(i + 1), label }));

/** Backend enforces exactly these two values (AllowedTimeFormats in
 * UpdateLegalEntityGeneralSettingsCommandValidator.cs). */
export const TIME_FORMAT_OPTIONS: readonly SelectOption[] = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' }
];

/** Backend enforces exactly these two values (AllowedStatuses in
 * UpdateLegalEntityGeneralSettingsCommandValidator.cs). */
export const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

/** Curated for UX only - backend only enforces NotEmpty + maxLength(20), no enum.
 * Any of these values (all <= 20 chars) will be accepted by the backend. */
export const DATE_FORMAT_OPTIONS: readonly SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
];
