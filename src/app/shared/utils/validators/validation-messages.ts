import { AbstractControl, ValidationErrors } from '@angular/forms';

type MessageFn = (label: string, detail: Record<string, unknown>) => string;

/** One message per rule key, used by every form (Improvements task 24). Add a key here, not a message in a template. */
const MESSAGES: Record<string, MessageFn | undefined> = {
  required: (label) => `${label} is required.`,
  maxlength: (label, d) => `${label} must be ${String(d['requiredLength'])} characters or fewer.`,
  minlength: (label, d) => `${label} must be at least ${String(d['requiredLength'])} characters.`,
  code: (label) => `${label} may only contain letters, numbers, hyphens and underscores.`,
  email: () => 'Enter a valid email address.',
  phone: () => 'Enter a valid phone number.',
  hexColor: () => 'Choose a colour from the list or the custom picker.',
  positive: (label) => `${label} must be more than 0.`,
  min: (label, d) => `${label} must be at least ${String(d['min'])}.`,
  max: (label, d) => `${label} must be at most ${String(d['max'])}.`,
  dateOrder: () => 'The end date must be on or after the start date.',
  dateSpan: (_label, d) => `The range must not be longer than ${String(d['maxDays'])} days.`,
  richTextLength: (label) => `${label} is too long. Shorten it or remove some formatting.`,
  integer: (label) => `${label} must be a whole number.`,
  absoluteUrl: () => 'Enter a full URL, e.g. https://example.com.',
  nameChars: (label) => `${label} may only contain letters, numbers, spaces, hyphens and underscores.`,
  oneOf: (label) => `Choose a ${label} from the list.`,
  mfaCode: () => 'Enter the 6-digit code.',
  mismatch: () => 'Passwords must match.',
  /** A backend field message placed by `applyServerFieldErrors` (already filtered for technical text). */
  server: (_label, d) => String(d['message']),
};

/** The message for the first error, or '' when there is none. `required` wins, so an empty field shows no length message. */
export function validationMessage(errors: ValidationErrors | null | undefined, label: string): string {
  if (!errors) return '';
  const keys = Object.keys(errors);
  if (keys.length === 0) return '';
  // Otherwise the first key, which is the first validator that failed in the order the control lists them.
  const key = 'required' in errors ? 'required' : keys[0];
  const detail = errors[key] as unknown;
  const message = MESSAGES[key];
  if (!message) return `Check ${label}.`;
  return message(label, typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : {});
}

/** For `app-input [error]`: the message once the user has touched the field, '' before that. */
export function fieldError(control: AbstractControl, label: string): string {
  return control.touched && control.invalid ? validationMessage(control.errors, label) : '';
}
