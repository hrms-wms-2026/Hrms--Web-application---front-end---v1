import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateLegalEntityRequest } from '../../models/legal-entity.model';
import { COUNTRY_CODE_OPTIONS, CURRENCY_CODE_OPTIONS } from '../../utils/general-settings-options';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-create-company-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" title="Add company" (closed)="cancel.emit()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
        <app-input
          label="Company name *"
          [value]="form.controls.name.value || ''"
          (valueChange)="form.controls.name.setValue($event)"
          (blurred)="form.controls.name.markAsTouched()"
          [error]="form.controls.name.touched && form.controls.name.invalid ? 'Company name is required (max 200 chars).' : ''"
        />
        <app-input
          label="Company code *"
          [value]="form.controls.companyCode.value || ''"
          (valueChange)="form.controls.companyCode.setValue($event)"
          (blurred)="form.controls.companyCode.markAsTouched()"
          [error]="form.controls.companyCode.touched && form.controls.companyCode.invalid ? 'Company code is required (max 20 chars).' : ''"
        />
        <app-input
          label="Registration number *"
          [value]="form.controls.registrationNumber.value || ''"
          (valueChange)="form.controls.registrationNumber.setValue($event)"
          (blurred)="form.controls.registrationNumber.markAsTouched()"
          [error]="form.controls.registrationNumber.touched && form.controls.registrationNumber.invalid ? 'Registration number is required (max 50 chars).' : ''"
        />
        <app-select
          label="Country *"
          placeholder="Select country"
          [options]="countryOptions"
          [value]="form.controls.countryCode.value || ''"
          (valueChange)="form.controls.countryCode.setValue($event)"
          [error]="form.controls.countryCode.touched && form.controls.countryCode.invalid ? 'Country is required.' : ''"
        />
        <app-select
          label="Currency *"
          placeholder="Select currency"
          [options]="currencyOptions"
          [value]="form.controls.currencyCode.value || ''"
          (valueChange)="form.controls.currencyCode.setValue($event)"
          [error]="form.controls.currencyCode.touched && form.controls.currencyCode.invalid ? 'Currency is required.' : ''"
        />
        <app-input
          label="Tax registration number"
          [value]="form.controls.taxRegistrationNumber.value || ''"
          (valueChange)="form.controls.taxRegistrationNumber.setValue($event)"
          (blurred)="form.controls.taxRegistrationNumber.markAsTouched()"
          [error]="form.controls.taxRegistrationNumber.touched && form.controls.taxRegistrationNumber.invalid ? 'Max 80 characters.' : ''"
        />
        <app-select
          label="Parent company"
          [options]="parentOptions"
          [value]="form.controls.parentLegalEntityId.value || ''"
          (valueChange)="form.controls.parentLegalEntityId.setValue($event)"
        />

        <div class="mt-2 flex justify-end gap-2">
          <app-button type="button" variant="secondary" [disabled]="saving" (click)="cancel.emit()">Cancel</app-button>
          <app-button type="submit" [loading]="saving" [disabled]="saving">Create company</app-button>
        </div>
      </form>
    </app-modal>
  `
})
export class CreateCompanyModalComponent {
  private readonly fb = inject(FormBuilder);

  @Input() availableParents: readonly { id: string; name: string }[] = [];
  @Input() saving = false;

  @Output() save = new EventEmitter<CreateLegalEntityRequest>();
  @Output() cancel = new EventEmitter<void>();

  readonly countryOptions = COUNTRY_CODE_OPTIONS;
  readonly currencyOptions = CURRENCY_CODE_OPTIONS;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    companyCode: ['', [Validators.required, Validators.maxLength(20)]],
    registrationNumber: ['', [Validators.required, Validators.maxLength(50)]],
    countryCode: ['', [Validators.required, Validators.maxLength(3)]],
    currencyCode: ['', [Validators.required, Validators.maxLength(3)]],
    taxRegistrationNumber: ['', [Validators.maxLength(80)]],
    parentLegalEntityId: ['' as string | null]
  });

  get parentOptions(): readonly SelectOption[] {
    const opts: SelectOption[] = [{ value: '', label: 'No parent — top-level company' }];
    for (const p of this.availableParents) {
      opts.push({ value: p.id, label: p.name });
    }
    return opts;
  }

  onSubmit(): void {
    if (this.saving || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    this.save.emit({
      name: (val.name || '').trim(),
      companyCode: val.companyCode?.trim() ? val.companyCode.trim() : null,
      registrationNumber: (val.registrationNumber || '').trim(),
      countryCode: (val.countryCode || '').trim(),
      currencyCode: (val.currencyCode || '').trim(),
      taxRegistrationNumber: val.taxRegistrationNumber?.trim() ? val.taxRegistrationNumber.trim() : null,
      parentLegalEntityId: val.parentLegalEntityId ? val.parentLegalEntityId : null
    });
  }
}
