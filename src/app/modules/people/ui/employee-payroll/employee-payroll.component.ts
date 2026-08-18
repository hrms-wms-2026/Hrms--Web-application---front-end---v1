import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailPayroll } from '../../models/employee.model';

@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  template: `
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h3 class="text-sm font-semibold text-[var(--color-text-primary)] pb-3 mb-4 border-b border-[var(--color-border)]">
        Payroll & Bank Details
      </h3>
      @if (!payroll().hasBankDetailsOnFile) {
        <p class="text-xs text-[var(--color-text-secondary)] italic">
          No bank details on file.
        </p>
      } @else {
        <dl class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Bank Name</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ payroll().bankName || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Account Number</dt>
            <dd class="font-semibold text-[var(--color-text-primary)] font-mono text-xs bg-[var(--color-surface-secondary)] px-2.5 py-1 rounded-md inline-block">
              {{ payroll().maskedAccountNumber || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Account Type</dt>
            <dd class="font-semibold text-[var(--color-text-primary)] capitalize">{{ payroll().accountType || '—' }}</dd>
          </div>
        </dl>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePayrollComponent {
  readonly payroll = input.required<EmployeeDetailPayroll>();
}
