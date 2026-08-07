import * as isoCountries from 'i18n-iso-countries';
import * as isoCountriesEnLocale from 'i18n-iso-countries/langs/en.json';
import { SelectOption } from '../../../shared/ui/select/select.component';

/** i18n-iso-countries ships two entry points: the Node `main` build auto-registers
 * every locale, but Angular's build resolves the package's `browser` field instead,
 * which requires locales to be registered explicitly - without this, getNames()/
 * getName() silently return {} / undefined and the Country dropdowns render empty. */
isoCountries.registerLocale(isoCountriesEnLocale);

const COUNTRY_NAMES_BY_ALPHA2 = isoCountries.getNames('en', { select: 'official' });

/** Registered Business Address "Country" - backend only enforces MaximumLength(100),
 * no ISO enum (RegisteredBusinessAddress.Country in
 * UpdateLegalEntityGeneralSettingsCommandValidator.cs). Curated as a dropdown of
 * ISO-3166-1 country names for UX/data-quality only - free text still round-trips
 * fine since the backend stores whatever string is sent. */
export const COUNTRY_NAME_OPTIONS: readonly SelectOption[] = Object.values(COUNTRY_NAMES_BY_ALPHA2)
  .map((name) => ({ value: name, label: name }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Company Details "Country code (ISO alpha-3)" - backend only enforces NotEmpty +
 * MaximumLength(3), no ISO enum (CountryCode in the same validator). Curated here so
 * users pick a real ISO-3166-1 alpha-3 code instead of typing one (e.g. the alpha-2
 * code "LK" by mistake, which passes the length check but isn't a valid alpha-3). */
export const COUNTRY_CODE_OPTIONS: readonly SelectOption[] = Object.entries(COUNTRY_NAMES_BY_ALPHA2)
  .map(([alpha2, name]) => {
    const alpha3 = isoCountries.alpha2ToAlpha3(alpha2) ?? alpha2;
    return { value: alpha3, label: `${name} (${alpha3})` };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

/** Normalizes a legacy free-typed country code to the ISO alpha-3 form the
 * COUNTRY_CODE_OPTIONS dropdown expects, so existing records saved before this field
 * became a dropdown (e.g. the alpha-2 code "LK") still show as selected on load
 * instead of rendering blank. Falls back to the raw value if it isn't a recognized
 * alpha-2/alpha-3/numeric ISO-3166-1 code. */
export function normalizeCountryCode(raw: string): string {
  if (!raw) return raw;
  return isoCountries.toAlpha3(raw) ?? raw;
}

/** Normalizes a legacy free-typed country name to the exact casing the
 * COUNTRY_NAME_OPTIONS dropdown expects (case-insensitive match), so existing
 * records saved before this field became a dropdown still show as selected on load.
 * Cannot fix genuine misspellings (e.g. "sri lanaka") - those still render blank
 * until the user re-selects the correct option. */
export function normalizeCountryName(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim().toLowerCase();
  const match = COUNTRY_NAME_OPTIONS.find((option) => option.value.toLowerCase() === trimmed);
  return match ? match.value : raw;
}

/** Company Details "Currency code (ISO 4217)" via Intl.supportedValuesOf - no static
 * list to maintain, always matches the runtime's currency data. Backend only enforces
 * NotEmpty + MaximumLength(3) (CurrencyCode in the same validator). */
const CURRENCY_DISPLAY_NAMES = new Intl.DisplayNames(['en'], { type: 'currency' });
export const CURRENCY_CODE_OPTIONS: readonly SelectOption[] = Intl.supportedValuesOf('currency')
  .map((code) => ({ value: code, label: `${code} - ${CURRENCY_DISPLAY_NAMES.of(code)}` }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Company Details "Timezone" - IANA identifiers via Intl.supportedValuesOf, always
 * current with no static list to maintain. Backend only enforces NotEmpty +
 * MaximumLength(50) (Timezone in the same validator). */
export const TIMEZONE_OPTIONS: readonly SelectOption[] = Intl.supportedValuesOf('timeZone')
  .map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))
  .sort((a, b) => a.label.localeCompare(b.label));

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
