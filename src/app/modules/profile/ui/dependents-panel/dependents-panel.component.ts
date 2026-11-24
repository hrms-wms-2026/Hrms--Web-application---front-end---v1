import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dependent, UpsertDependentRequest } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { AppValidators, fieldError, validationMessage } from '../../../../shared/utils/validators';
import { DEPENDENT_LIMITS } from '../../utils/profile-limits';

@Component({
  selector: 'app-dependents-panel',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent, ButtonComponent, DatePickerComponent],
  templateUrl: './dependents-panel.component.html',
  styleUrls: ['../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DependentsPanelComponent {
  readonly dependents = input.required<Dependent[]>();
  readonly saving = input(false);
  readonly add = output<UpsertDependentRequest>();
  readonly remove = output<string>();

  readonly relationshipOptions: readonly SelectOption[] = [
    { value: 'spouse', label: 'Spouse' },
    { value: 'child', label: 'Child' },
    { value: 'parent', label: 'Parent' },
    { value: 'other', label: 'Other' }
  ];

  private readonly fb = new FormBuilder().nonNullable;
  protected readonly fieldError = fieldError;
  protected readonly validationMessage = validationMessage;
  readonly addForm = this.fb.group({
    name: ['', AppValidators.name(DEPENDENT_LIMITS.nameMax)],
    relationship: ['child' as Dependent['relationship'], Validators.required],
    dateOfBirth: ['', Validators.required],
    phone: ['', AppValidators.maxLength(DEPENDENT_LIMITS.phoneMax)]
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
      dateOfBirth: value.dateOfBirth,
      isEmergencyContact: false,
      phone: value.phone || null
    });
    this.addForm.reset({ relationship: 'child' });
  }

  /** Footer "Save changes": adds a half-typed dependent (relationship alone has a default, so it doesn't count). */
  submitIfFilled(): 'empty' | 'submitted' | 'invalid' {
    const { name, dateOfBirth, phone } = this.addForm.getRawValue();
    if (![name, dateOfBirth, phone].some((v) => (v ?? '').trim())) return 'empty';
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
