import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';
import { EmployeeDocumentsComponent } from '../../ui/employee-documents/employee-documents.component';

/**
 * Personal tab, laid out like the Employment tab (no KPI strip - there is nothing to count here):
 * Personal Information + Addresses, then Emergency Contacts + Payroll, then the employee's
 * uploaded Documents (read-only). Payroll renders only when the server included it
 * (employees:read:sensitive is enforced there); without it, Emergency Contacts takes the whole row.
 */
@Component({
  selector: 'app-employee-personal-tab',
  standalone: true,
  imports: [EmployeePersonalInfoComponent, EmployeeEmergencyContactsComponent, EmployeePayrollComponent, EmployeeDocumentsComponent],
  template: `
    <div class="space-y-3">
      <!-- The personal-info component renders two cards straight into this grid (3/5 + 2/5). -->
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <app-employee-personal-info [personalInformation]="employee().personalInformation" />
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <app-employee-emergency-contacts
          [class.xl:col-span-3]="!!employee().payroll"
          [class.xl:col-span-5]="!employee().payroll"
          [emergencyContacts]="employee().emergencyContacts"
        />
        @if (employee().payroll; as payroll) {
          <app-employee-payroll
            class="xl:col-span-2"
            [employeeId]="employee().id"
            [payroll]="payroll"
          />
        }
      </div>

      <app-employee-documents [employeeId]="employee().id" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalTabComponent {
  readonly employee = input.required<EmployeeDetailResponse>();
}
