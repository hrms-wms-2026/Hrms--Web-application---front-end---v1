import { FormControl } from '@angular/forms';
import { absoluteUrlValidator, nonEmptyArrayValidator, oneOfValidator } from './general-settings-validators';

describe('nonEmptyArrayValidator', () => {
  it('fails on an empty array', () => {
    const control = new FormControl<number[]>([], { nonNullable: true, validators: [nonEmptyArrayValidator()] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ required: true });
  });

  it('passes when at least one value is present', () => {
    const control = new FormControl<number[]>([1], { nonNullable: true, validators: [nonEmptyArrayValidator()] });
    expect(control.valid).toBe(true);
  });
});

describe('absoluteUrlValidator', () => {
  it('passes on empty value (optional field)', () => {
    const control = new FormControl<string | null>(null, { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(true);
  });

  it('fails on a relative/schemeless value', () => {
    const control = new FormControl<string | null>('example.com', { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ absoluteUrl: true });
  });

  it('passes on a valid absolute URL', () => {
    const control = new FormControl<string | null>('https://example.com', { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(true);
  });
});

describe('oneOfValidator', () => {
  const validator = oneOfValidator(['12h', '24h']);

  it('passes on empty value (required validator handles emptiness separately)', () => {
    const control = new FormControl<string | null>(null, { validators: [validator] });
    expect(control.valid).toBe(true);
  });

  it('fails on a value outside the allowed set', () => {
    const control = new FormControl<string | null>('36h', { validators: [validator] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ oneOf: true });
  });

  it('passes on an allowed value', () => {
    const control = new FormControl<string | null>('24h', { validators: [validator] });
    expect(control.valid).toBe(true);
  });
});
