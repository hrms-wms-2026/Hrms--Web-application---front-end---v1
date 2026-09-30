import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeeEmergencyContactsComponent } from '../../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../../ui/employee-payroll/employee-payroll.component';
import { EmployeePersonalInfoComponent } from '../../../ui/employee-personal-info/employee-personal-info.component';

/**
 * Personal tab: personal information, emergency contacts, and - only when the response carries
 * it (the caller may read payroll) - payroll & statutory details.
 */
@Component({
  selector: 'app-employee-personal-tab',
  standalone: true,
  imports: [EmployeePersonalInfoComponent, EmployeeEmergencyContactsComponent, EmployeePayrollComponent],
  template: `
    @if (store.employee(); as employee) {
      <div class="space-y-4">
        <section class="detail-card" aria-label="Personal information">
          <app-employee-personal-info [personalInformation]="employee.personalInformation" />
        </section>
        <section class="detail-card" aria-label="Emergency contacts">
          <app-employee-emergency-contacts [emergencyContacts]="employee.emergencyContacts" />
        </section>
        @if (employee.payroll; as payroll) {
          <section class="detail-card" aria-label="Payroll and statutory">
            <app-employee-payroll [payroll]="payroll" />
          </section>
        }
      </div>
    }
  `,
  styleUrl: './employee-detail-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
}
