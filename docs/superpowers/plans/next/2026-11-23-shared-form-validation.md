# Shared Form Validation Rules Implementation Plan (Improvements task 24)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One set of named, tested validators and one message map, so the same rule gives the same message on every form, and the form limits match the backend validators.

**Architecture:** The rules are pure functions in `shared/utils/validators/validation-rules.ts`, so signal-based forms (the leave request wizard) can call them directly. `form-validators.ts` wraps them as Angular `ValidatorFn`s for reactive forms. `validation-messages.ts` turns an errors object into one message. `fieldError(control, label)` feeds `app-input`'s `[error]`, and `<app-field-error>` shows a message for fields that are not `app-input`. Limits live in one constants file per domain. Each constant names the backend validator it mirrors.

**Tech Stack:** Angular 21 reactive forms and signals, Vitest.

**Source task:** `docs/Improvements/person-4-api-layer-and-cleanup/task-24 Shared form validation rules.md`. Depends on backend task 19, merged in backend PR #240 (`ValidationRuleExtensions`, `InputLimits`).

---

## Decisions

1. **Never looser than the backend.** A frontend limit may be stricter than the backend's, but never looser, because looser means the user fills in a form that looks valid and then gets a server error. Every stricter limit we keep is recorded in the task file's status section.
2. **Limits are hand-written per domain.** The OpenAPI document (`HRMS-Backend-v1/docs/api/openapi/tenant-v1.json`) does not carry FluentValidation limits, and the generated types from task 08 (PR #170) are not merged. So the limits are constants with a comment naming the backend file.
3. **Match backend meaning, not just numbers.**
   - Required text trims, like the backend's `ValidName` (`!string.IsNullOrWhiteSpace`). `"   "` fails.
   - Rich text length counts the stored HTML string, like `ValidRichText`. It does not count the visible text.
4. **Server field errors stay out.** The backend's 400 body today is `{ errors: { "PropertyName": ["message"] } }` with PascalCase keys. Mapping those onto controls is task 20 (one error handling standard, blocked on backend task 24). This task only takes plain messages.
5. **Error keys use Angular's names** (`required`, `maxlength`, `min`, `pattern`), so errors from built-in `Validators` that are still in the code get the same messages.

## Drift found (frontend vs backend)

| Form field | Frontend before | Backend | Action |
|---|---|---|---|
| Department name | max 200 | max 100 (`DepartmentInputValidator`) | **Fix to 100** |
| Department code | no pattern | `^[A-Za-z0-9_-]{1,20}$` on the trimmed value | **Add the pattern** |
| Department code | required | optional | Keep required (stricter); record it |
| Leave type name / code | 100 / 20 | 100 / 20 (`LeaveTypeInputValidator`, `CreateLeaveTypeCommandValidator`) | Same; move to constants |
| Leave type description | max 500 | no rule, column is `nvarchar(max)` | Keep 500 (stricter); record it. Read it from the existing `TEXT_LIMITS.leaveTypeDescription` |
| Leave request reason | max 500 | max 2000 (`SubmitLeaveRequestCommandValidator`) | Keep 500 (stricter, product decision); record it |

## File structure

- Create `src/app/shared/utils/validators/validation-rules.ts`: pure rule functions.
- Create `src/app/shared/utils/validators/validation-rules.spec.ts`.
- Create `src/app/shared/utils/validators/form-validators.ts`: `AppValidators` (`ValidatorFn` wrappers).
- Create `src/app/shared/utils/validators/form-validators.spec.ts`.
- Create `src/app/shared/utils/validators/validation-messages.ts`: `validationMessage(errors, label)` and `fieldError(control, label)`.
- Create `src/app/shared/utils/validators/validation-messages.spec.ts`.
- Create `src/app/shared/utils/validators/index.ts`: barrel.
- Create `src/app/shared/ui/field-error/field-error.component.ts` and its `.spec.ts`.
- Create `src/app/modules/organization/utils/organization-limits.ts`.
- Create `src/app/modules/leave/utils/leave-limits.ts`.
- Modify the department form modal (`.ts`, `.html`) and add a spec.
- Modify the leave type form modal (`.ts`, `.html`, `.spec.ts`).
- Modify the leave request wizard (`.ts`, `.html`).
- Modify `docs/core/ARCHITECTURE.md` §6.4 and the task 24 file.

---

### Task 1: Pure rules

**Files:** Create `src/app/shared/utils/validators/validation-rules.ts` and `validation-rules.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { dateRange, email, maxLength, pattern, phone, positiveNumber, requiredText, richTextLength } from './validation-rules';

describe('validation rules', () => {
  it('requiredText fails on null, empty and whitespace, like the backend ValidName', () => {
    expect(requiredText(null)).toEqual({ required: true });
    expect(requiredText('')).toEqual({ required: true });
    expect(requiredText('   ')).toEqual({ required: true });
    expect(requiredText(' a ')).toBeNull();
  });

  it('maxLength counts characters and passes empty values', () => {
    expect(maxLength('abc', 3)).toBeNull();
    expect(maxLength('abcd', 3)).toEqual({ maxlength: { requiredLength: 3, actualLength: 4 } });
    expect(maxLength(null, 3)).toBeNull();
  });

  it('email and phone pass empty values and check the format otherwise', () => {
    expect(email('')).toBeNull();
    expect(email('a@b.co')).toBeNull();
    expect(email('a@b')).toEqual({ email: true });
    expect(phone(null)).toBeNull();
    expect(phone('+94 77 123 4567')).toBeNull();
    expect(phone('12ab')).toEqual({ phone: true });
  });

  it('pattern checks the trimmed value under a named key', () => {
    const code = /^[A-Za-z0-9_-]{1,20}$/;
    expect(pattern(' HR-1 ', code, 'code')).toBeNull();
    expect(pattern('R&D', code, 'code')).toEqual({ code: true });
    expect(pattern('', code, 'code')).toBeNull();
  });

  it('positiveNumber needs a number above zero and passes empty values', () => {
    expect(positiveNumber(null)).toBeNull();
    expect(positiveNumber(0.5)).toBeNull();
    expect(positiveNumber(0)).toEqual({ positive: true });
    expect(positiveNumber(-1)).toEqual({ positive: true });
  });

  it('richTextLength counts the stored HTML, not the visible text', () => {
    expect(richTextLength('<b>hi</b>', 9)).toBeNull();
    expect(richTextLength('<b>hi</b>', 8)).toEqual({ richTextLength: { requiredLength: 8, actualLength: 9 } });
  });

  it('dateRange checks order, then the maximum span, and skips when an end is missing', () => {
    expect(dateRange('2026-01-02', '2026-01-01')).toEqual({ dateOrder: true });
    expect(dateRange('2026-01-01', '2026-01-01')).toBeNull();
    expect(dateRange('2026-01-01', '2026-01-31', 30)).toBeNull();
    expect(dateRange('2026-01-01', '2026-02-01', 30)).toEqual({ dateSpan: { maxDays: 30 } });
    expect(dateRange('', '2026-01-01')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and check it fails** (module not found).
  `npx ng test --watch=false --include "src/app/shared/utils/validators/**/*.spec.ts"`

- [ ] **Step 3: Implement**

```ts
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

function isEmpty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === '';
}

/** Something other than whitespace, like the backend's `ValidName(required: true)`. */
export function requiredText(value: string | null | undefined): ValidationErrors | null {
  return value === null || value === undefined || value.trim() === '' ? { required: true } : null;
}

export function maxLength(value: string | null | undefined, max: number): ValidationErrors | null {
  if (isEmpty(value) || value!.length <= max) return null;
  return { maxlength: { requiredLength: max, actualLength: value!.length } };
}

export function email(value: string | null | undefined): ValidationErrors | null {
  return isEmpty(value) || EMAIL.test(value!.trim()) ? null : { email: true };
}

export function phone(value: string | null | undefined): ValidationErrors | null {
  return isEmpty(value) || PHONE.test(value!.trim()) ? null : { phone: true };
}

/** A format rule on the trimmed value, reported under `key` so the message map can name it. */
export function pattern(value: string | null | undefined, regex: RegExp, key: string): ValidationErrors | null {
  return isEmpty(value) || regex.test(value!.trim()) ? null : { [key]: true };
}

export function positiveNumber(value: number | null | undefined): ValidationErrors | null {
  return value === null || value === undefined || value > 0 ? null : { positive: true };
}

/** Counts the stored HTML, like the backend's `ValidRichText`, so formatting cannot carry text past the limit. */
export function richTextLength(html: string | null | undefined, max: number): ValidationErrors | null {
  if (isEmpty(html) || html!.length <= max) return null;
  return { richTextLength: { requiredLength: max, actualLength: html!.length } };
}

/** Two `yyyy-MM-dd` dates: the end not before the start, and at most `maxDays` apart when given. */
export function dateRange(start: string | null | undefined, end: string | null | undefined, maxDays?: number): ValidationErrors | null {
  if (isEmpty(start) || isEmpty(end)) return null;
  if (end! < start!) return { dateOrder: true };
  if (maxDays !== undefined && (Date.parse(end!) - Date.parse(start!)) / DAY_MS > maxDays) return { dateSpan: { maxDays } };
  return null;
}
```

- [ ] **Step 4: Run it and check it passes.**
- [ ] **Step 5: Commit** `feat(validation): shared pure form rules`

### Task 2: `ValidatorFn` wrappers

**Files:** Create `form-validators.ts` and `form-validators.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { FormControl, FormGroup } from '@angular/forms';
import { AppValidators } from './form-validators';

describe('AppValidators', () => {
  it('name() is required text with a maximum length', () => {
    const control = new FormControl('   ', AppValidators.name(5));
    expect(control.errors).toEqual({ required: true });
    control.setValue('abcdef');
    expect(control.errors).toEqual({ maxlength: { requiredLength: 5, actualLength: 6 } });
    control.setValue('abc');
    expect(control.errors).toBeNull();
  });

  it('name() with required false lets an empty value through', () => {
    expect(new FormControl('', AppValidators.name(5, { required: false })).errors).toBeNull();
  });

  it('pattern() reports under its key', () => {
    expect(new FormControl('R&D', AppValidators.pattern(/^[A-Z]+$/, 'code')).errors).toEqual({ code: true });
  });

  it('dateRange() is a group validator on two controls', () => {
    const group = new FormGroup(
      { from: new FormControl('2026-01-02'), to: new FormControl('2026-01-01') },
      { validators: AppValidators.dateRange('from', 'to') },
    );
    expect(group.errors).toEqual({ dateOrder: true });
  });

  it('each single rule has a wrapper', () => {
    expect(new FormControl('a@b', AppValidators.email()).errors).toEqual({ email: true });
    expect(new FormControl('12ab', AppValidators.phone()).errors).toEqual({ phone: true });
    expect(new FormControl(0, AppValidators.positiveNumber()).errors).toEqual({ positive: true });
    expect(new FormControl('abcd', AppValidators.maxLength(3)).errors).not.toBeNull();
    expect(new FormControl('<p>x</p>', AppValidators.richTextLength(3)).errors).not.toBeNull();
    expect(new FormControl(' ', AppValidators.requiredText()).errors).toEqual({ required: true });
  });
});
```

- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement**

```ts
import { AbstractControl, ValidatorFn } from '@angular/forms';
import * as rules from './validation-rules';

/** Reactive-forms wrappers around `validation-rules.ts`. Use these instead of writing a validator per form. */
export const AppValidators = {
  requiredText: (): ValidatorFn => (c: AbstractControl) => rules.requiredText(c.value as string | null),
  maxLength: (max: number): ValidatorFn => (c: AbstractControl) => rules.maxLength(c.value as string | null, max),
  /** A short plain-text name: required (unless `required: false`) and at most `max` characters, like `ValidName`. */
  name:
    (max: number, options: { required?: boolean } = {}): ValidatorFn =>
    (c: AbstractControl) => {
      const value = c.value as string | null;
      return (options.required === false ? null : rules.requiredText(value)) ?? rules.maxLength(value, max);
    },
  email: (): ValidatorFn => (c: AbstractControl) => rules.email(c.value as string | null),
  phone: (): ValidatorFn => (c: AbstractControl) => rules.phone(c.value as string | null),
  pattern: (regex: RegExp, key: string): ValidatorFn => (c: AbstractControl) => rules.pattern(c.value as string | null, regex, key),
  positiveNumber: (): ValidatorFn => (c: AbstractControl) => rules.positiveNumber(c.value as number | null),
  richTextLength: (max: number): ValidatorFn => (c: AbstractControl) => rules.richTextLength(c.value as string | null, max),
  /** Group validator: `endKey`'s date is not before `startKey`'s, and at most `maxDays` after it when given. */
  dateRange:
    (startKey: string, endKey: string, maxDays?: number): ValidatorFn =>
    (group: AbstractControl) =>
      rules.dateRange(group.get(startKey)?.value as string | null, group.get(endKey)?.value as string | null, maxDays),
} as const;
```

- [ ] **Step 4: Run it and check it passes.**
- [ ] **Step 5: Commit** `feat(validation): AppValidators for reactive forms`

### Task 3: Message map and `fieldError`

**Files:** Create `validation-messages.ts`, `validation-messages.spec.ts` and `index.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { FormControl, Validators } from '@angular/forms';
import { AppValidators } from './form-validators';
import { fieldError, validationMessage } from './validation-messages';

describe('validationMessage', () => {
  it('gives one message per rule, naming the field', () => {
    expect(validationMessage({ required: true }, 'Department name')).toBe('Department name is required.');
    expect(validationMessage({ maxlength: { requiredLength: 100, actualLength: 101 } }, 'Department name')).toBe(
      'Department name must be 100 characters or fewer.',
    );
    expect(validationMessage({ code: true }, 'Department code')).toBe(
      'Department code may only contain letters, numbers, hyphens and underscores.',
    );
    expect(validationMessage({ email: true }, 'Email')).toBe('Enter a valid email address.');
    expect(validationMessage({ phone: true }, 'Phone')).toBe('Enter a valid phone number.');
    expect(validationMessage({ hexColor: true }, 'Colour')).toBe('Choose a colour from the list, or enter one as #RRGGBB.');
    expect(validationMessage({ positive: true }, 'Hours')).toBe('Hours must be more than 0.');
    expect(validationMessage({ min: { min: 0.5, actual: 0 } }, 'Hours')).toBe('Hours must be at least 0.5.');
    expect(validationMessage({ dateOrder: true }, 'Dates')).toBe('The end date must be on or after the start date.');
    expect(validationMessage({ dateSpan: { maxDays: 30 } }, 'Dates')).toBe('The range must not be longer than 30 days.');
    expect(validationMessage({ richTextLength: { requiredLength: 10, actualLength: 11 } }, 'Description')).toBe(
      'Description is too long. Shorten it or remove some formatting.',
    );
  });

  it('shows required first, and a generic message for an unknown key', () => {
    expect(validationMessage({ maxlength: { requiredLength: 1, actualLength: 2 }, required: true }, 'Name')).toBe('Name is required.');
    expect(validationMessage({ somethingNew: true }, 'Name')).toBe('Check Name.');
    expect(validationMessage(null, 'Name')).toBe('');
  });

  it('maps Angular built-in validators to the same messages', () => {
    expect(validationMessage(new FormControl('', Validators.required).errors, 'Name')).toBe('Name is required.');
  });
});

describe('fieldError', () => {
  it('stays empty until the control is touched', () => {
    const control = new FormControl('', AppValidators.name(10));
    expect(fieldError(control, 'Name')).toBe('');
    control.markAsTouched();
    expect(fieldError(control, 'Name')).toBe('Name is required.');
    control.setValue('ok');
    expect(fieldError(control, 'Name')).toBe('');
  });
});
```

- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement**

```ts
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
  hexColor: () => 'Choose a colour from the list, or enter one as #RRGGBB.',
  positive: (label) => `${label} must be more than 0.`,
  min: (label, d) => `${label} must be at least ${String(d['min'])}.`,
  max: (label, d) => `${label} must be at most ${String(d['max'])}.`,
  dateOrder: () => 'The end date must be on or after the start date.',
  dateSpan: (_label, d) => `The range must not be longer than ${String(d['maxDays'])} days.`,
  richTextLength: (label) => `${label} is too long. Shorten it or remove some formatting.`,
};

/** `required` wins, so an empty field does not show a length message. */
const ORDER = ['required'];

/** The message for the first error, or '' when there is none. */
export function validationMessage(errors: ValidationErrors | null | undefined, label: string): string {
  if (!errors) return '';
  const keys = Object.keys(errors);
  if (keys.length === 0) return '';
  const key = ORDER.find((k) => k in errors) ?? keys[0];
  const detail = errors[key] as unknown;
  const message = MESSAGES[key];
  return message ? message(label, typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : {}) : `Check ${label}.`;
}

/** For `app-input [error]`: the message once the user has touched the field, '' before that. */
export function fieldError(control: AbstractControl, label: string): string {
  return control.touched && control.invalid ? validationMessage(control.errors, label) : '';
}
```

`index.ts`:

```ts
export * from './validation-rules';
export * from './form-validators';
export * from './validation-messages';
```

- [ ] **Step 4: Run it and check it passes.**
- [ ] **Step 5: Commit** `feat(validation): one message map and fieldError`

### Task 4: `<app-field-error>`

**Files:** Create `src/app/shared/ui/field-error/field-error.component.ts` and `.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
  it('renders the message with the shared error style, and nothing when empty', () => {
    const fixture = TestBed.createComponent(FieldErrorComponent);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ui-field-error')).toBeNull();

    fixture.componentRef.setInput('message', 'Use a colour like #2563EB.');
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('.ui-field-error');
    expect(el?.textContent?.trim()).toBe('Use a colour like #2563EB.');
    expect(el?.getAttribute('role')).toBe('alert');
  });
});
```

- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A field error for controls that are not `app-input` (colour pickers, chip groups, custom pickers). `app-input`
 * already shows its own `[error]`. Pass the message from `fieldError()` or `validationMessage()`.
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (message()) {
    <p class="ui-field-error" role="alert">{{ message() }}</p>
  }`,
})
export class FieldErrorComponent {
  readonly message = input<string>('');
}
```

- [ ] **Step 4: Run it and check it passes.**
- [ ] **Step 5: Commit** `feat(ui): app-field-error for non-input fields`

### Task 5: Domain limits

**Files:** Create `src/app/modules/organization/utils/organization-limits.ts` and `src/app/modules/leave/utils/leave-limits.ts`. They hold constants only, so they have no spec. They are covered by the form specs in Tasks 6–8.

- [ ] **Step 1: Write the files**

```ts
/**
 * Form limits for the organization module (Improvements task 24). Each mirrors a backend validator. The frontend may
 * be stricter, never looser: a looser limit lets the user submit a form the server rejects.
 */
export const DEPARTMENT_LIMITS = {
  /** `DepartmentInputValidator`: name required, max 100. */
  nameMax: 100,
  /** `DepartmentInputValidator`: code max 20. The backend allows an empty code; the form requires one (stricter). */
  codeMax: 20,
  /** `DepartmentInputValidator.CodePattern`, checked on the trimmed code. */
  codePattern: /^[A-Za-z0-9_-]{1,20}$/,
} as const;
```

```ts
/**
 * Form limits for the leave module (Improvements task 24). Each mirrors a backend validator. The frontend may be
 * stricter, never looser.
 */
export const LEAVE_TYPE_LIMITS = {
  /** `LeaveTypeInputValidator`: name required, max 100. */
  nameMax: 100,
  /** `CreateLeaveTypeCommandValidator`: code required, max 20. */
  codeMax: 20,
  /** No backend rule (the column is nvarchar(max)). 500 keeps descriptions short on the type list (stricter). */
  descriptionMax: 500,
  /** `LeaveTypeInputValidator`: `#RRGGBB`. */
  colorPattern: /^#[0-9a-fA-F]{6}$/,
  /** `LeaveTypeInputValidator`: the document threshold must be more than 0 hours. The form asks for at least 0.5. */
  documentAfterHoursMin: 0.5,
} as const;

export const LEAVE_REQUEST_LIMITS = {
  /** `SubmitLeaveRequestCommandValidator` allows 2000. The form keeps 500 (stricter, a product decision). */
  reasonMax: 500,
} as const;
```

- [ ] **Step 2: Commit** `feat(validation): organization and leave form limits mirroring the backend validators`

### Task 6: Department form modal (small form, fixes real drift)

**Files:** Modify `department-form-modal.component.ts` and `.html`. Create `department-form-modal.component.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { TestBed } from '@angular/core/testing';
import { DepartmentFormModalComponent } from './department-form-modal.component';

describe('DepartmentFormModalComponent validation', () => {
  function setup() {
    const fixture = TestBed.createComponent(DepartmentFormModalComponent);
    fixture.componentRef.setInput('companyName', 'Acme');
    fixture.detectChanges();
    return fixture;
  }

  it('rejects a name over the backend limit of 100', () => {
    const { form } = setup().componentInstance;
    form.controls.name.setValue('a'.repeat(101));
    expect(form.controls.name.errors).toEqual({ maxlength: { requiredLength: 100, actualLength: 101 } });
    form.controls.name.setValue('a'.repeat(100));
    expect(form.controls.name.errors).toBeNull();
  });

  it('rejects a whitespace-only name and a code with characters the backend refuses', () => {
    const { form } = setup().componentInstance;
    form.controls.name.setValue('   ');
    expect(form.controls.name.errors).toEqual({ required: true });
    form.controls.code.setValue('R&D');
    expect(form.controls.code.errors).toEqual({ code: true });
    form.controls.code.setValue(' HR-1 ');
    expect(form.controls.code.errors).toBeNull();
  });

  it('shows the shared messages once the fields are touched, and does not emit', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.save.subscribe(emitted);
    component.form.controls.code.setValue('R&D');
    component.onSubmit();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Department name is required.');
    expect(text).toContain('Department code may only contain letters, numbers, hyphens and underscores.');
    expect(emitted).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and check it fails** (maxlength 200, no `code` error).
- [ ] **Step 3: Implement.** In the component, import `AppValidators` and `fieldError` from `'../../../../shared/utils/validators'` and `DEPARTMENT_LIMITS` from `'../../utils/organization-limits'`. Drop `Validators` from the forms import. Then:

```ts
  protected readonly fieldError = fieldError;

  readonly form = this.fb.group({
    name: ['', AppValidators.name(DEPARTMENT_LIMITS.nameMax)],
    code: ['', [AppValidators.requiredText(), AppValidators.maxLength(DEPARTMENT_LIMITS.codeMax), AppValidators.pattern(DEPARTMENT_LIMITS.codePattern, 'code')]],
    parentDepartmentId: ['' as string | null],
    headPositionId: ['' as string | null]
  });
```

In the template, replace the two hand-written `[error]` bindings:

```html
            [error]="fieldError(form.controls.name, 'Department name')"
```

```html
            [error]="fieldError(form.controls.code, 'Department code')"
```

- [ ] **Step 4: Run it and check it passes.**
- [ ] **Step 5: Commit** `fix(organization): department form uses the shared validators and the backend's 100-character name limit and code pattern`

### Task 7: Leave type form modal (medium form)

**Files:** Modify `leave-type-form-modal.component.ts`, `.html` and `.spec.ts`.

- [ ] **Step 1: Write the failing tests** (add them to the existing describe):

```ts
  it('uses the shared messages for name, code and colour', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    form.controls.name.setValue('   ');
    form.controls.code.setValue('a'.repeat(21));
    form.controls.color.setValue('blue');
    form.markAllAsTouched();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
    expect(text).toContain('Code must be 20 characters or fewer.');
    expect(text).toContain('Choose a colour from the list, or enter one as #RRGGBB.');
  });
```

Check the existing spec's `setup` first. If the modal needs inputs (a `type` input, for example), set them the same way the existing tests do.

- [ ] **Step 2: Run it and check it fails** (`Enter a name (up to 100 characters).` is still shown, and `'   '` passes `Validators.required`).
- [ ] **Step 3: Implement.** Import `AppValidators`, `fieldError` and `validationMessage` from `'../../../../shared/utils/validators'`, `LEAVE_TYPE_LIMITS` from `'../../utils/leave-limits'` and `FieldErrorComponent`. Delete the local `HEX_COLOR` and add `FieldErrorComponent` to `imports`. Then:

```ts
  protected readonly fieldError = fieldError;
  protected readonly validationMessage = validationMessage;

  readonly form = this.fb.group({
    name: ['', AppValidators.name(LEAVE_TYPE_LIMITS.nameMax)],
    code: ['', AppValidators.name(LEAVE_TYPE_LIMITS.codeMax)],
    description: ['', AppValidators.maxLength(LEAVE_TYPE_LIMITS.descriptionMax)],
    color: [LEAVE_TYPE_COLORS[0] as string, [Validators.required, AppValidators.pattern(LEAVE_TYPE_LIMITS.colorPattern, 'hexColor')]],
    isPaid: [true],
    applicableGender: ['all', Validators.required],
    requiresDocument: [false],
    documentRequiredAfterHours: [null as number | null, Validators.min(LEAVE_TYPE_LIMITS.documentAfterHoursMin)],
    icon: [null as string | null]
  });
```

Template:
- name: `[error]="fieldError(form.controls.name, 'Name')"`
- code: `[error]="fieldError(form.controls.code, 'Code')"`
- colour: replace the `@if (form.controls.color.invalid) { <p ...>Use a colour like #2563EB.</p> }` block with `<app-field-error class="ltfm-error" [message]="validationMessage(form.controls.color.errors, 'Colour')" />`. The colour error shows without a touch, as it did before.

- [ ] **Step 4: Run it and check it passes, along with every existing test in the file.**
- [ ] **Step 5: Commit** `refactor(leave): leave type form uses the shared validators and messages`

### Task 8: Leave request wizard (signal form)

**Files:** Modify `new-leave-request-wizard.component.ts` and `.html`.

- [ ] **Step 1: Keep the existing test as the guard.** The spec already expects `dateRangeHint()` to be `'The end date must be on or after the start date.'` (line 300). The shared `dateOrder` message keeps that exact text, so that test must stay green unchanged.
- [ ] **Step 2: Implement.** Import `dateRange` and `validationMessage` from `'../../../../shared/utils/validators'` and `LEAVE_REQUEST_LIMITS` from `'../../utils/leave-limits'`. Then:

```ts
  readonly reasonMaxLength = LEAVE_REQUEST_LIMITS.reasonMax;
```

and in `dateRangeHint()` replace `if (d.endDate < d.startDate) return 'The end date must be on or after the start date.';` with:

```ts
    const rangeError = dateRange(d.startDate, d.endDate);
    if (rangeError) return validationMessage(rangeError, 'Dates');
```

- [ ] **Step 3: Run the wizard spec.** Expected: all tests pass.
  `npx ng test --watch=false --include "src/app/modules/leave/ui/new-leave-request-wizard/**/*.spec.ts"`
- [ ] **Step 4: Commit** `refactor(leave): leave request wizard reads the shared date rule and reason limit`

### Task 9: Docs, remaining forms, full gate

**Files:** Modify `docs/core/ARCHITECTURE.md` §6.4 (Input Validation & Sanitization) and the task 24 file. Add a row to `docs/superpowers/plans/SUMMARY.md` and an entry to `plans/next/SUMMARY.md`.

- [ ] **Step 1: Architecture rule.** Add to §6.4:

```markdown
**Form validation (decided 2026-11-23, Improvements task 24).** Use `AppValidators` from `shared/utils/validators` (or the pure rules in `validation-rules.ts` for signal forms), show errors with `fieldError(control, label)` on `app-input` and `<app-field-error>` elsewhere, and add any new message to `validation-messages.ts`, never as text in a template. Limits come from the module's `utils/<module>-limits.ts`, each naming the backend validator it mirrors. A frontend limit may be stricter than the backend's, never looser. The backend keeps its own rules; never remove one because the frontend has it.
```

- [ ] **Step 2: Remaining forms list.** In the task file, add `## Status (2026-11-23)` with what was done, the drift table above, and a table of every form still on hand-written rules. Get the list with:
  `git grep -l -E "Validators\.|\[error\]=\"form\.controls" -- "src/app/**/*.ts" "src/app/**/*.html" | grep -v spec`
  Give each form an owner. Default to Person 4 as the task-24 follow-up. The big three (`add-employee-wizard`, `position-management`, `task-form-modal`) go to their module owners because they are mid-refactor. Company name/code (200/20) was checked against `CreateLegalEntityCommandValidator`: it matches.
- [ ] **Step 3: Gate.**
  `npm run check:warnings`, `npx ng lint`, `node scripts/check-hardcoded-colors.mjs`, `npx ng test --watch=false`.
  Expected: no new warnings, no lint error in a file this branch changes, and no new test failures (the pre-existing en-GB date tests and load timeouts are known).
- [ ] **Step 4: Commit** `docs: shared form validation rule and task 24 status`, then push and open the PR against `Development`.
