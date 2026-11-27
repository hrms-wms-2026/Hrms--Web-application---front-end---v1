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
