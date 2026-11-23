import { ValidationErrors } from '@angular/forms';

/**
 * Pure form rules (Improvements task 24). They mirror the backend's shared FluentValidation rules
 * (`ONEVO.Application/Common/Validation/ValidationRuleExtensions.cs`): the frontend helps the user, the backend protects
 * the data, so both keep their rules. Every rule except `requiredText` passes an empty value; combine it with
 * `requiredText` when the field is required. Error keys use Angular's names where Angular has one.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{7,20}$/;
const DAY_MS = 86_400_000;

type Text = string | null | undefined;

function present(value: Text): value is string {
  return value !== null && value !== undefined && value !== '';
}

/** Something other than whitespace, like the backend's `ValidName(required: true)`. */
export function requiredText(value: Text): ValidationErrors | null {
  return value === null || value === undefined || value.trim() === '' ? { required: true } : null;
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

/** A format rule on the trimmed value, reported under `key` so the message map can name it. */
export function pattern(value: Text, regex: RegExp, key: string): ValidationErrors | null {
  return !present(value) || regex.test(value.trim()) ? null : { [key]: true };
}

export function positiveNumber(value: number | null | undefined): ValidationErrors | null {
  return value === null || value === undefined || value > 0 ? null : { positive: true };
}

/** Counts the stored HTML, like the backend's `ValidRichText`, so formatting cannot carry text past the limit. */
export function richTextLength(html: Text, max: number): ValidationErrors | null {
  if (!present(html) || html.length <= max) return null;
  return { richTextLength: { requiredLength: max, actualLength: html.length } };
}

/** Two `yyyy-MM-dd` dates: the end not before the start, and at most `maxDays` apart when given. */
export function dateRange(start: Text, end: Text, maxDays?: number): ValidationErrors | null {
  if (!present(start) || !present(end)) return null;
  if (end < start) return { dateOrder: true };
  if (maxDays !== undefined && (Date.parse(end) - Date.parse(start)) / DAY_MS > maxDays) return { dateSpan: { maxDays } };
  return null;
}
