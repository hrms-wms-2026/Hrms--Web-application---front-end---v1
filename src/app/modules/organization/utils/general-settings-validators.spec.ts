import { FormControl, FormGroup } from '@angular/forms';
import { absoluteUrlValidator, nonEmptyArrayValidator, oneOfValidator, workTimePairValidator } from './general-settings-validators';

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

describe('workTimePairValidator', () => {
  /** Helper — creates a minimal FormGroup with only the two time controls. */
  function makeGroup(start: string, end: string): FormGroup {
    return new FormGroup(
      {
        workStartTime: new FormControl<string>(start, { nonNullable: true }),
        workEndTime: new FormControl<string>(end, { nonNullable: true })
      },
      { validators: [workTimePairValidator()] }
    );
  }

  it('is valid when both fields are blank (no schedule set)', () => {
    const group = makeGroup('', '');
    expect(group.valid).toBe(true);
    expect(group.errors).toBeNull();
  });

  it('is valid when both fields carry a valid HH:mm pair (start < end)', () => {
    const group = makeGroup('09:00', '17:30');
    expect(group.valid).toBe(true);
    expect(group.errors).toBeNull();
  });

  it('returns both_required when only workStartTime is set', () => {
    const group = makeGroup('09:00', '');
    expect(group.errors).toEqual({ workTimePair: 'both_required' });
  });

  it('returns both_required when only workEndTime is set', () => {
    const group = makeGroup('', '17:30');
    expect(group.errors).toEqual({ workTimePair: 'both_required' });
  });

  it('is valid for overnight 22:00-06:00', () => {
    const group = makeGroup('22:00', '06:00');
    expect(group.valid).toBe(true);
    expect(group.errors).toBeNull();
  });

  it('is valid when start equals end (24h overnight window)', () => {
    const group = makeGroup('09:00', '09:00');
    expect(group.valid).toBe(true);
  });
});
