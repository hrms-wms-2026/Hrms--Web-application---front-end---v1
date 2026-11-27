import { AbstractControl, ValidatorFn } from '@angular/forms';
import * as rules from './validation-rules';

type Text = string | null;

/** Reactive-forms wrappers around `validation-rules.ts` (Improvements task 24). Use these instead of a validator per form. */
export const AppValidators = {
  requiredText: (): ValidatorFn => (c: AbstractControl) => rules.requiredText(c.value as Text),
  maxLength: (max: number): ValidatorFn => (c: AbstractControl) => rules.maxLength(c.value as Text, max),
  /** A short plain-text name: required (unless `required: false`) and at most `max` characters, like `ValidName`. */
  name:
    (max: number, options: { required?: boolean } = {}): ValidatorFn =>
    (c: AbstractControl) => {
      const value = c.value as Text;
      return (options.required === false ? null : rules.requiredText(value)) ?? rules.maxLength(value, max);
    },
  email: (): ValidatorFn => (c: AbstractControl) => rules.email(c.value as Text),
  phone: (): ValidatorFn => (c: AbstractControl) => rules.phone(c.value as Text),
  pattern:
    (regex: RegExp, key: string): ValidatorFn =>
    (c: AbstractControl) =>
      rules.pattern(c.value as Text, regex, key),
  positiveNumber: (): ValidatorFn => (c: AbstractControl) => rules.positiveNumber(c.value as number | null),
  richTextLength: (max: number): ValidatorFn => (c: AbstractControl) => rules.richTextLength(c.value as Text, max),
  /** Group validator: `endKey`'s date is not before `startKey`'s, and at most `maxDays` after it when given. */
  dateRange:
    (startKey: string, endKey: string, maxDays?: number): ValidatorFn =>
    (group: AbstractControl) =>
      rules.dateRange(group.get(startKey)?.value as Text | undefined, group.get(endKey)?.value as Text | undefined, maxDays),
} as const;
