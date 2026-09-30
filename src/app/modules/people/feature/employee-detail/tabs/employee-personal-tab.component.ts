import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { DetailCardComponent } from '../../../ui/detail-kit/detail-card.component';
import { KvRowComponent } from '../../../ui/detail-kit/kv-row.component';
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
    DetailCardComponent,
    KvRowComponent,
    EmployeePersonalInfoComponent,
    EmployeeEmergencyContactsComponent,
    EmployeePayrollComponent,
    EmployeeProfileCompletionComponent
  ],
  template: `
    @if (store.employee(); as employee) {
      <div class="personal">
        <div class="personal__main">
          <app-employee-personal-info [personalInformation]="employee.personalInformation" />
          <app-employee-emergency-contacts [emergencyContacts]="employee.emergencyContacts" />
          @if (employee.payroll; as payroll) {
            <app-detail-card icon="briefcase" title="Payroll & Statutory">
              <app-employee-payroll [payroll]="payroll" />
            </app-detail-card>
          }
        </div>

        <aside class="personal__side" aria-label="Profile summary">
          <app-employee-profile-completion [completion]="completion()!" />

          <app-detail-card icon="calendar" title="Important Dates">
            <dl class="dates">
              <div>
                <dt>Hire Date</dt>
                <dd>{{ employee.jobInformation.hireDate ? (employee.jobInformation.hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
              </div>
              <div>
                <dt>Work Anniversary</dt>
                @if (anniversary(); as next) {
                  <dd data-testid="work-anniversary">
                    {{ next.date | date: 'dd MMM yyyy' }}
                    <span class="dates__hint">{{ next.daysUntil === 0 ? 'today' : 'in ' + next.daysUntil + (next.daysUntil === 1 ? ' day' : ' days') }}</span>
                  </dd>
                } @else {
                  <dd>—</dd>
                }
              </div>
            </dl>
          </app-detail-card>

          <app-detail-card icon="info" title="Additional Information">
            <app-kv-row label="Employee ID">{{ employee.jobInformation.employeeNumber }}</app-kv-row>
            <app-kv-row label="Department">{{ employee.jobInformation.departmentName || '—' }}</app-kv-row>
            <app-kv-row label="Position">{{ employee.jobInformation.positionName || 'Unassigned' }}</app-kv-row>
            <app-kv-row label="Employment Type">{{ employee.jobInformation.employmentTypeLabel || '—' }}</app-kv-row>
            <app-kv-row label="Work Mode">{{ employee.jobInformation.workModeLabel || '—' }}</app-kv-row>
            <app-kv-row label="Time Zone">{{ employee.jobInformation.timezone || '—' }}</app-kv-row>
          </app-detail-card>
        </aside>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .personal { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 1100px) { .personal { grid-template-columns: minmax(0, 1fr) 23rem; align-items: start; } }
    .personal__main, .personal__side { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 0; }
    .dates dt { font-size: 0.8125rem; color: var(--color-text-secondary); }
    .dates dd { margin: 0.25rem 0 0; font-size: 1rem; font-weight: 600; color: var(--color-text-primary); }
    .dates__hint { display: block; font-size: 0.8125rem; font-weight: 400; color: var(--color-text-secondary); }
  `],
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
