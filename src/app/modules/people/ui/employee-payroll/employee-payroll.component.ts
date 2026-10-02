import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailPayroll } from '../../models/employee.model';

/** Styled like the Employment tab's cards: icon header, compact label/value rows, a real empty state. */
@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <section class="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs" data-testid="payroll-card">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10 12 4l9 6"></path><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"></path>
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold text-slate-900">Payroll & Bank Details</h2>
          <p class="text-[11px] text-slate-500">Where salary is paid</p>
        </div>
      </header>

      @if (!payroll().hasBankDetailsOnFile) {
        <div class="flex flex-1 flex-col items-center justify-center py-4 text-center" data-testid="payroll-empty">
          <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400" aria-hidden="true">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="M2.5 10h19M6.5 15h4"></path>
            </svg>
          </span>
          <p class="text-xs text-slate-500">No bank details on file.</p>
        </div>
      } @else {
        <dl class="space-y-2.5 text-[13px]">
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Bank Name</dt>
            <dd class="font-medium text-slate-900">{{ payroll().bankName || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Account Number</dt>
            <dd><span class="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-900">{{ payroll().maskedAccountNumber || '—' }}</span></dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Account Type</dt>
            <dd class="font-medium capitalize text-slate-900">{{ payroll().accountType || '—' }}</dd>
          </div>
        </dl>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePayrollComponent {
  readonly payroll = input.required<EmployeeDetailPayroll>();
}
