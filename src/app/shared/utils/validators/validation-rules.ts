import { ValidationErrors } from '@angular/forms';

/**
 * Pure form rules (Improvements task 24). They mirror the backend's shared FluentValidation rules
 * (backend `Application/Common/Validation/ValidationRuleExtensions.cs`): the frontend helps the user, the backend protects
 * the data, so both keep their rules. Every rule except `requiredText` passes an empty value; combine it with
 * `requiredText` when the field is required. Error keys use Angular's names where Angular has one.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{7,20}$/;
const DAY_MS = 86_400_000;

type Text = string | null | undefined;

/** These are text rules: a value that is not a string (a number bound by mistake) counts as empty, never throws. */
function present(value: Text): value is string {
  return typeof value === 'string' && value !== '';
}

/** Something other than whitespace, like the backend's `ValidName(required: true)`. */
export function requiredText(value: Text): ValidationErrors | null {
  return typeof value !== 'string' || value.trim() === '' ? { required: true } : null;
}

export function maxLength(value: Text, max: number): ValidationErrors | null {
  if (!present(value) || value.length <= max) return null;
  return { maxlength: { requiredLength: max, actualLength: value.length } };
}

export function email(value: Text): ValidationErrors | null {
  return !present(value) || EMAIL.test(value.trim()) ? null : { email: true };
}

export function phone(value: Text): ValidationErrors | null {
  return !present(value) || PHONE.test(value.trim()) ? null : { phone: true };
}

/** A format rule on the trimmed value, reported under `key` so the message map can name it. Blank is left to `requiredText`. */
export function pattern(value: Text, regex: RegExp, key: string): ValidationErrors | null {
  if (!present(value) || value.trim() === '') return null;
  return regex.test(value.trim()) ? null : { [key]: true };
}

export function positiveNumber(value: number | null | undefined): ValidationErrors | null {
  return value === null || value === undefined || value > 0 ? null : { positive: true };
}

/** Counts the stored HTML, like the backend's `ValidRichText`, so formatting cannot carry text past the limit. */
export function richTextLength(html: Text, max: number): ValidationErrors | null {
  if (!present(html) || html.length <= max) return null;
  return { richTextLength: { requiredLength: max, actualLength: html.length } };
}

/**
 * Two `yyyy-MM-dd` dates: the end not before the start, and at most `maxDays` apart when given. The span counts the
 * days between the dates (01-01 to 01-31 is 30), like the backend's `to.DayNumber - from.DayNumber > maxDays`. A date
 * that does not parse is left to that field's own rule, so the range check skips it.
 */
export function dateRange(start: Text, end: Text, maxDays?: number): ValidationErrors | null {
  if (!present(start) || !present(end)) return null;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  if (to < from) return { dateOrder: true };
  if (maxDays !== undefined && (to - from) / DAY_MS > maxDays) return { dateSpan: { maxDays } };
  return null;
}
