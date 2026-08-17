import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailPayroll } from '../../models/employee.model';

@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  template: `
    @if (!payroll().hasBankDetailsOnFile) {
      <p class="max-w-2xl rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
        No bank details on file.
      </p>
    } @else {
      <dl class="grid max-w-2xl grid-cols-2 gap-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Bank Name</dt>
        <dd>{{ payroll().bankName || '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Account Number</dt>
        <dd>{{ payroll().maskedAccountNumber || '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Account Type</dt>
        <dd>{{ payroll().accountType || '—' }}</dd>
      </dl>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePayrollComponent {
  readonly payroll = input.required<EmployeeDetailPayroll>();
}
