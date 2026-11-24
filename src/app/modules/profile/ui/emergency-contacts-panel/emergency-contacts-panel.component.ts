import { ChangeDetectionStrategy, Component, input, output, effect, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmergencyContact, UpsertEmergencyContactRequest } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AppValidators, applyServerFieldErrors, failedSaveToast, fieldError, validationMessage } from '../../../../shared/utils/validators';
import { EMERGENCY_CONTACT_LIMITS } from '../../utils/profile-limits';
import { ApiError } from '../../../../core/errors/api-error';
import { FieldErrorComponent } from '../../../../shared/ui/field-error/field-error.component';

@Component({
  selector: 'app-emergency-contacts-panel',
  standalone: true,
  imports: [FieldErrorComponent, ReactiveFormsModule, InputComponent, ButtonComponent],
  templateUrl: './emergency-contacts-panel.component.html',
  styleUrls: ['../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmergencyContactsPanelComponent {
  readonly contacts = input.required<EmergencyContact[]>();
  readonly saving = input(false);
  readonly add = output<UpsertEmergencyContactRequest>();
  readonly remove = output<string>();

  private readonly fb = new FormBuilder().nonNullable;
  protected readonly fieldError = fieldError;
  protected readonly validationMessage = validationMessage;
  readonly addForm = this.fb.group({
    name: ['', AppValidators.name(EMERGENCY_CONTACT_LIMITS.nameMax)],
    relationship: ['', AppValidators.name(EMERGENCY_CONTACT_LIMITS.relationshipMax)],
    phone: ['', AppValidators.name(EMERGENCY_CONTACT_LIMITS.phoneMax)],
    email: ['', [Validators.email, AppValidators.maxLength(EMERGENCY_CONTACT_LIMITS.emailMax)]]
  });

  /** The profile tab passes this panel's own failed save (task 20). */
  readonly serverError = input<ApiError | null>(null);
  /** A message from that save that has no field here, or a refusal without field errors. */
  protected readonly serverFormError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const error = this.serverError();
      untracked(() =>
        this.serverFormError.set(
          error ? (applyServerFieldErrors(this.addForm, error, ['name', 'relationship', 'phone', 'email']) ?? failedSaveToast(error, 'Could not save.')) : null,
        ),
      );
    });
  }

  onSubmitAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    const value = this.addForm.getRawValue();
    this.add.emit({
      name: value.name,
      relationship: value.relationship,
      phone: value.phone,
      email: value.email || null,
      isPrimary: this.contacts().length === 0
    });
    this.addForm.reset();
  }

  /** Footer "Save changes": adds a half-typed contact. Returns false when the form is filled but invalid. */
  submitIfFilled(): 'empty' | 'submitted' | 'invalid' {
    const { name, relationship, phone, email } = this.addForm.getRawValue();
    if (![name, relationship, phone, email].some((v) => v.trim())) return 'empty';
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return 'invalid';
    }
    this.onSubmitAdd();
    return 'submitted';
  }

  onRemove(id: string): void {
    this.remove.emit(id);
  }
}
