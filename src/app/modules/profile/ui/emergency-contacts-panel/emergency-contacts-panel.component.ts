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

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  onRemove(id: string): void {
    this.remove.emit(id);
  }
}
