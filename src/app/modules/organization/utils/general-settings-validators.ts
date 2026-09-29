import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { computeWorkDayHours } from './work-day-hours';

/** Angular's built-in Validators.required treats [] as truthy (non-empty array
 * always passes) - this closes that gap for standardWorkingDays. */
export function nonEmptyArrayValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown[] | null;
    return value && value.length > 0 ? null : { required: true };
  };
}

/** Mirrors backend's Uri.TryCreate(url, UriKind.Absolute, out _) - only
 * validates when a value is present, matching the backend's .When(...) guard. */
export function absoluteUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    try {
      new URL(value);
      return null;
    } catch {
      return { absoluteUrl: true };
    }
  };
}

/** Defense for timeFormat/status beyond what a constrained <select> already
 * guarantees - only validates when a value is present. */
export function oneOfValidator(allowed: readonly string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    return allowed.includes(value) ? null : { oneOf: true };
  };
}

/**
 * Group-level validator for the workStartTime / workEndTime pair.
 *
 * Mirrors the backend's UpdateLegalEntityGeneralSettingsCommandValidator:
 *   - Both blank/null → valid (no schedule set).
 *   - Exactly one blank → { workTimePair: 'both_required' }.
 *   - Both set is valid including overnight (end <= start means next calendar day).
 *   - Break covering the whole shift → { workTimePair: 'break_covers_shift' }.
 *
 * Applied to the FormGroup, not individual controls. Read errors via
 * `form.errors?.['workTimePair']`.
 */
export function workTimePairValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = (group.get('workStartTime')?.value as string | null | undefined) ?? '';
    const end = (group.get('workEndTime')?.value as string | null | undefined) ?? '';
    const hasStart = start.trim() !== '';
    const hasEnd = end.trim() !== '';

    if (!hasStart && !hasEnd) {
      return null; // both absent — valid
    }
    if (hasStart !== hasEnd) {
      return { workTimePair: 'both_required' };
    }
    const hours = computeWorkDayHours(start, end, group.get('breakDurationMinutes')?.value);
    if (hours !== null && hours <= 0) {
      return { workTimePair: 'break_covers_shift' };
    }
    return null;
  };
}

/**
 * Group-level validator for officeLatitude / officeLongitude.
 *
 * Mirrors the backend's office-location check constraint: both set together, or both
 * blank/null. officeAddress is a display label only and not part of this rule. The
 * geofence radius lives on Clock-in Policy (AllowedRadiusMeters), not here. Applied to
 * the FormGroup - read via `form.errors?.['officeLocation']`.
 */
export function officeLocationValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const latitude = group.get('officeLatitude')?.value as number | null;
    const longitude = group.get('officeLongitude')?.value as number | null;

    const allAbsent = latitude == null && longitude == null;
    const allPresent = latitude != null && longitude != null;

    return allAbsent || allPresent ? null : { officeLocation: true };
  };
}
