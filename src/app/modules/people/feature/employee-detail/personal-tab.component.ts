import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';

/** Payroll renders only when the server included it (employees:read:sensitive is enforced there). */
@Component({
  selector: 'app-employee-personal-tab',
  standalone: true,
  imports: [EmployeePersonalInfoComponent, EmployeeEmergencyContactsComponent, EmployeePayrollComponent],
  template: `
    <div class="space-y-4">
      <app-employee-personal-info [personalInformation]="employee().personalInformation" />
      <app-employee-emergency-contacts [emergencyContacts]="employee().emergencyContacts" />
      @if (employee().payroll; as payroll) {
        <app-employee-payroll [payroll]="payroll" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalTabComponent {
  readonly employee = input.required<EmployeeDetailResponse>();
}
