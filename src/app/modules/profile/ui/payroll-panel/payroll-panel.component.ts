import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PayrollInfo, UpdateBankDetailsRequest } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AppValidators, fieldError, validationMessage } from '../../../../shared/utils/validators';
import { BANK_DETAILS_LIMITS } from '../../utils/profile-limits';

@Component({
  selector: 'app-payroll-panel',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  templateUrl: './payroll-panel.component.html',
  styleUrls: ['../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PayrollPanelComponent {
  readonly payroll = input.required<PayrollInfo>();
  readonly saving = input(false);
  readonly save = output<UpdateBankDetailsRequest>();

  readonly isEditing = signal(false);

  readonly showForm = computed(() => {
    if (!this.payroll().canEdit) return false;
    if (!this.payroll().hasBankDetailsOnFile) return true;
    return this.isEditing();
  });

  private readonly fb = new FormBuilder().nonNullable;
  protected readonly fieldError = fieldError;
  protected readonly validationMessage = validationMessage;
  readonly form = this.fb.group({
    bankName: ['', AppValidators.name(BANK_DETAILS_LIMITS.bankNameMax)],
    branchName: ['', AppValidators.name(BANK_DETAILS_LIMITS.branchNameMax)],
    accountHolderName: ['', AppValidators.name(BANK_DETAILS_LIMITS.accountHolderNameMax)],
    accountNumber: ['', AppValidators.name(BANK_DETAILS_LIMITS.accountNumberMax)],
    accountType: ['', AppValidators.name(BANK_DETAILS_LIMITS.accountTypeMax)],
    routingNumber: ['', AppValidators.maxLength(BANK_DETAILS_LIMITS.routingNumberMax)]
  });

  startEdit(): void {
    const data = this.payroll();
    this.form.patchValue({
      bankName: data.bankName ?? '',
      accountType: data.accountType ?? ''
    });
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({
      bankName: value.bankName,
      branchName: value.branchName,
      accountHolderName: value.accountHolderName,
      accountNumber: value.accountNumber,
      accountType: value.accountType,
      routingNumber: value.routingNumber || null
    });
  }
}
