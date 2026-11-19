import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewPasswordFieldsComponent } from './new-password-fields.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, NewPasswordFieldsComponent],
  template: `
    <form [formGroup]="form">
      <app-new-password-fields passwordPlaceholder="Pick one" confirmPlaceholder="Repeat it" />
    </form>
  `
})
class HostComponent {
  form = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });
}

describe('NewPasswordFieldsComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    return { fixture, root };
  }

  it('renders both inputs with the given placeholders and stable ids', () => {
    const { root } = setup();
    const password = root.querySelector<HTMLInputElement>('#password');
    const confirm = root.querySelector<HTMLInputElement>('#confirmPassword');

    expect(password?.placeholder).toBe('Pick one');
    expect(confirm?.placeholder).toBe('Repeat it');
    expect(password?.type).toBe('password');
    expect(confirm?.type).toBe('password');
  });

  it('shows no error text until the controls are touched', () => {
    const { root } = setup();
    expect(root.querySelector('.new-password-error')).toBeNull();
  });

  it('shows the error messages when the parent marks the form as touched', () => {
    const { fixture, root } = setup();

    fixture.componentInstance.form.markAllAsTouched();
    fixture.detectChanges();

    const messages = Array.from(root.querySelectorAll('.new-password-error')).map((el) => el.textContent?.trim());
    expect(messages).toEqual(['Password must be at least 8 characters.', 'Passwords must match.']);
    expect(root.querySelectorAll('.ui-field--error').length).toBe(2);
  });

  it('shows the mismatch message when the parent sets the mismatch error', () => {
    const { fixture, root } = setup();
    const { form } = fixture.componentInstance;
    form.setValue({ password: 'Password123!', confirmPassword: 'Different123!' });
    form.controls.confirmPassword.setErrors({ mismatch: true });
    form.markAllAsTouched();
    fixture.detectChanges();

    const messages = Array.from(root.querySelectorAll('.new-password-error')).map((el) => el.textContent?.trim());
    expect(messages).toEqual(['Passwords must match.']);
  });

  it('toggles each field between hidden and visible independently', () => {
    const { fixture, root } = setup();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.ui-field__icon-btn');
    const password = root.querySelector<HTMLInputElement>('#password')!;
    const confirm = root.querySelector<HTMLInputElement>('#confirmPassword')!;

    buttons[0].click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(confirm.type).toBe('password');
    expect(buttons[0].getAttribute('aria-label')).toBe('Hide password');

    buttons[1].click();
    fixture.detectChanges();
    expect(confirm.type).toBe('text');

    buttons[0].click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
    expect(buttons[0].getAttribute('aria-label')).toBe('Show password');
  });
});
