import { ChangeDetectionStrategy, Component, OnChanges, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PersonalInformation, UpdatePersonalInformationRequest } from '../../models/profile.model';
import { ProfileValidators } from '../../utils/profile-validators';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TIMEZONE_OPTIONS } from '../../../organization/utils/general-settings-options';

@Component({
  selector: 'app-personal-info-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent, ButtonComponent, AvatarComponent, DatePickerComponent],
  templateUrl: './personal-info-form.component.html',
  styleUrls: ['./personal-info-form.component.css', '../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonalInfoFormComponent implements OnChanges {
  readonly personalInformation = input.required<PersonalInformation>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly save = output<UpdatePersonalInformationRequest>();
  readonly avatarSelected = output<File>();

  readonly genderOptions: readonly SelectOption[] = [
    { value: '', label: 'Prefer not to say' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
  ];

  readonly timezoneOptions = TIMEZONE_OPTIONS;

  private readonly fb = new FormBuilder().nonNullable;

  form = this.buildForm(null);

  ngOnChanges(): void {
    this.form = this.buildForm(this.personalInformation());
  }

  displayName(): string {
    const info = this.personalInformation();
    const name = [info.firstName, info.lastName].filter(Boolean).join(' ').trim();
    return name || info.email;
  }

  private buildForm(info: PersonalInformation | null) {
    return this.fb.group({
      firstName: [info?.firstName ?? '', [Validators.required, Validators.maxLength(100)]],
      lastName: [info?.lastName ?? '', [Validators.required, Validators.maxLength(100)]],
      phone: [info?.phone ?? ''],
      dateOfBirth: [info?.dateOfBirth ?? ''],
      gender: [info?.gender ?? ''],
      displayTimezone: [this.effectiveDisplayTimezone(info)]
    });
  }

  private effectiveDisplayTimezone(info: PersonalInformation | null): string {
    if (!info) return '';
    return info.displayTimezone ?? info.legalEntityTimezone ?? '';
  }

  private resolveSavedTimezone(selected: string): string | null {
    const trimmed = selected.trim();
    if (!trimmed) return null;

    const inherited = this.personalInformation().legalEntityTimezone;
    if (inherited && trimmed === inherited) {
      return null;
    }

    return trimmed;
  }

  onSubmit(): void {
    if (this.form.invalid || !this.isPhoneValid()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.save.emit({
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone || null,
      dateOfBirth: value.dateOfBirth || null,
      gender: value.gender || null,
      nationalityId: this.personalInformation().nationalityId,
      displayTimezone: this.resolveSavedTimezone(value.displayTimezone),
      addresses: this.personalInformation().addresses.map((a) => ({
        addressType: a.addressType,
        addressJson: a.addressJson,
        isPrimary: a.isPrimary
      })),
      version: this.personalInformation().version
    });
  }

  onAvatarFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (file) {
      this.avatarSelected.emit(file);
    }
  }

  isPhoneValid(): boolean {
    const phone = this.form.value.phone;
    return !phone || ProfileValidators.isValidPhone(phone);
  }
}
