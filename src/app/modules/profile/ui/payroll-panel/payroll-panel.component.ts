import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PayrollInfo, UpdateBankDetailsRequest } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

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

  private readonly fb = new FormBuilder().nonNullable;
  readonly form = this.fb.group({
    bankName: ['', Validators.required],
    branchName: ['', Validators.required],
    accountHolderName: ['', Validators.required],
    accountNumber: ['', Validators.required],
    accountType: ['', Validators.required],
    routingNumber: ['']
  });

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
