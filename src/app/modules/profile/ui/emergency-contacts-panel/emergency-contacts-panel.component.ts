import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmergencyContact, UpsertEmergencyContactRequest } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-emergency-contacts-panel',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
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
  readonly addForm = this.fb.group({
    name: ['', Validators.required],
    relationship: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['']
  });

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
