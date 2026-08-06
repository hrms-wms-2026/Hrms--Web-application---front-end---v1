import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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
