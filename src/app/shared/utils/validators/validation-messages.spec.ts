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
    expect(validationMessage({ hexColor: true }, 'Colour')).toBe('Use a colour like #2563EB.');
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
