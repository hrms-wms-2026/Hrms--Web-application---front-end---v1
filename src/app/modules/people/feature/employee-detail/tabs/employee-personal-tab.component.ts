import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeeEmergencyContactsComponent } from '../../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../../ui/employee-payroll/employee-payroll.component';
import { EmployeePersonalInfoComponent } from '../../../ui/employee-personal-info/employee-personal-info.component';
import { EmployeeProfileCompletionComponent } from '../../../ui/employee-profile-completion/employee-profile-completion.component';
import { nextWorkAnniversary, profileCompletion } from '../../../utils/employee-detail.utils';

/**
 * Personal tab: personal, contact, address and emergency contact sections, payroll (only when the
 * response carries it), plus a side column with profile completion, important dates and a
 * read-only employment summary.
 */
@Component({
  selector: 'app-employee-personal-tab',
  standalone: true,
  imports: [
    DatePipe,
    EmployeePersonalInfoComponent,
    EmployeeEmergencyContactsComponent,
    EmployeePayrollComponent,
    EmployeeProfileCompletionComponent
  ],
  template: `
    @if (store.employee(); as employee) {
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="flex min-w-0 flex-col gap-4">
          <app-employee-personal-info [personalInformation]="employee.personalInformation" />
          <app-employee-emergency-contacts [emergencyContacts]="employee.emergencyContacts" />
          @if (employee.payroll; as payroll) {
            <section class="detail-card" aria-label="Payroll and statutory">
              <app-employee-payroll [payroll]="payroll" />
            </section>
          }
        </div>

        <aside class="flex min-w-0 flex-col gap-4" aria-label="Profile summary">
          <app-employee-profile-completion [completion]="completion()!" />

          <section class="detail-card" aria-labelledby="important-dates-heading">
            <h2 id="important-dates-heading" class="detail-card__title">Important Dates</h2>
            <dl class="grid grid-cols-2 gap-4 m-0">
              <div>
                <dt class="text-xs text-[var(--color-text-secondary)]">Hire Date</dt>
                <dd class="m-0 text-sm font-semibold text-[var(--color-text-primary)]">
                  {{ employee.jobInformation.hireDate ? (employee.jobInformation.hireDate | date: 'dd MMM yyyy') : '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-secondary)]">Work Anniversary</dt>
                @if (anniversary(); as next) {
                  <dd class="m-0 text-sm font-semibold text-[var(--color-text-primary)]" data-testid="work-anniversary">
                    {{ next.date | date: 'dd MMM yyyy' }}
                    <span class="block text-xs font-normal text-[var(--color-text-secondary)]">
                      {{ next.daysUntil === 0 ? 'today' : 'in ' + next.daysUntil + (next.daysUntil === 1 ? ' day' : ' days') }}
                    </span>
                  </dd>
                } @else {
                  <dd class="m-0 text-sm font-semibold text-[var(--color-text-primary)]">—</dd>
                }
              </div>
            </dl>
          </section>

          <section class="detail-card" aria-labelledby="additional-info-heading">
            <h2 id="additional-info-heading" class="detail-card__title">Additional Information</h2>
            <dl class="detail-list">
              <dt>Employee ID</dt><dd>{{ employee.jobInformation.employeeNumber }}</dd>
              <dt>Department</dt><dd>{{ employee.jobInformation.departmentName || '—' }}</dd>
              <dt>Position</dt><dd>{{ employee.jobInformation.positionName || 'Unassigned' }}</dd>
              <dt>Employment Type</dt><dd>{{ employee.jobInformation.employmentTypeLabel || '—' }}</dd>
              <dt>Work Mode</dt><dd>{{ employee.jobInformation.workModeLabel || '—' }}</dd>
              <dt>Time Zone</dt><dd>{{ employee.jobInformation.timezone || '—' }}</dd>
            </dl>
          </section>
        </aside>
      </div>
    }
  `,
  styleUrl: './employee-detail-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalTabComponent {
  protected readonly store = inject(EmployeeDetailStore);

  readonly completion = computed(() => {
    const employee = this.store.employee();
    return employee ? profileCompletion(employee) : null;
  });
  readonly anniversary = computed(() => nextWorkAnniversary(this.store.employee()?.jobInformation.hireDate));
}
