import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateLegalEntityRequest } from '../../models/legal-entity.model';
import { COUNTRY_CODE_OPTIONS, CURRENCY_CODE_OPTIONS } from '../../utils/general-settings-options';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AppValidators, applyServerFieldErrors, fieldError } from '../../../../shared/utils/validators';
import { COMPANY_LIMITS } from '../../utils/organization-limits';
import { ApiError } from '../../../../core/errors/api-error';
import { FieldErrorComponent } from '../../../../shared/ui/field-error/field-error.component';

@Component({
  selector: 'app-create-company-modal',
  standalone: true,
  imports: [FieldErrorComponent, CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" title="Add company" (closed)="cancelled.emit()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
        <app-input
          label="Company name *"
          [value]="form.controls.name.value || ''"
          (valueChange)="form.controls.name.setValue($event)"
          (blurred)="form.controls.name.markAsTouched()"
          [error]="fieldError(form.controls.name, 'Company name')"
        />
        <app-input
          label="Company code *"
          [value]="form.controls.companyCode.value || ''"
          (valueChange)="form.controls.companyCode.setValue($event)"
          (blurred)="form.controls.companyCode.markAsTouched()"
          [error]="fieldError(form.controls.companyCode, 'Company code')"
        />
        <app-input
          label="Registration number *"
          [value]="form.controls.registrationNumber.value || ''"
          (valueChange)="form.controls.registrationNumber.setValue($event)"
          (blurred)="form.controls.registrationNumber.markAsTouched()"
          [error]="fieldError(form.controls.registrationNumber, 'Registration number')"
        />
        <app-select
          label="Country *"
          placeholder="Select country"
          [options]="countryOptions"
          [value]="form.controls.countryCode.value || ''"
          (valueChange)="form.controls.countryCode.setValue($event)"
          [error]="fieldError(form.controls.countryCode, 'Country')"
        />
        <app-select
          label="Currency *"
          placeholder="Select currency"
          [options]="currencyOptions"
          [value]="form.controls.currencyCode.value || ''"
          (valueChange)="form.controls.currencyCode.setValue($event)"
          [error]="fieldError(form.controls.currencyCode, 'Currency')"
        />
        <app-input
          label="Tax registration number"
          [value]="form.controls.taxRegistrationNumber.value || ''"
          (valueChange)="form.controls.taxRegistrationNumber.setValue($event)"
          (blurred)="form.controls.taxRegistrationNumber.markAsTouched()"
          [error]="fieldError(form.controls.taxRegistrationNumber, 'Tax registration number')"
        />
        <app-select
          label="Parent company"
          [options]="parentOptions"
          [value]="form.controls.parentLegalEntityId.value || ''"
          (valueChange)="form.controls.parentLegalEntityId.setValue($event)"
        />

        <app-field-error [message]="serverFormError() ?? ''" />
        <div class="mt-2 flex justify-end gap-2">
          <app-button type="button" variant="secondary" [disabled]="saving" (click)="cancelled.emit()">Cancel</app-button>
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
  /** A message from a refused save that matches no field, shown inside the modal (task 20). */
  protected readonly serverFormError = signal<string | null>(null);

  /** The store's ApiError for the last failed save: field messages go next to their fields. */
  @Input() set serverError(value: ApiError | null) {
    this.serverFormError.set(value ? applyServerFieldErrors(this.form, value) : null);
  }


  @Output() save = new EventEmitter<CreateLegalEntityRequest>();
  @Output() cancelled = new EventEmitter<void>();

  readonly countryOptions = COUNTRY_CODE_OPTIONS;
  readonly currencyOptions = CURRENCY_CODE_OPTIONS;

  protected readonly fieldError = fieldError;

  readonly form = this.fb.group({
    name: ['', AppValidators.name(COMPANY_LIMITS.nameMax)],
    companyCode: ['', AppValidators.name(COMPANY_LIMITS.codeMax)],
    registrationNumber: ['', AppValidators.name(COMPANY_LIMITS.registrationNumberMax)],
    countryCode: ['', [Validators.required, Validators.maxLength(COMPANY_LIMITS.countryCodeMax)]],
    currencyCode: ['', [Validators.required, Validators.maxLength(COMPANY_LIMITS.currencyCodeMax)]],
    taxRegistrationNumber: ['', AppValidators.maxLength(COMPANY_LIMITS.taxRegistrationNumberMax)],
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
