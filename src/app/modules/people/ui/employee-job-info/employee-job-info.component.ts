import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailJobInformation } from '../../models/employee.model';

@Component({
  selector: 'app-employee-job-info',
  standalone: true,
  template: `
    <dl class="grid max-w-2xl grid-cols-2 gap-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm">
      <dt class="text-[var(--color-text-secondary)]">Employee number</dt>
      <dd>{{ jobInformation().employeeNumber }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Position</dt>
      <dd>{{ jobInformation().positionName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Department</dt>
      <dd>{{ jobInformation().departmentName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Legal Entity</dt>
      <dd>{{ jobInformation().legalEntityName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Employment Type</dt>
      <dd>{{ jobInformation().employmentTypeLabel }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Status</dt>
      <dd class="capitalize">{{ jobInformation().status }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Reporting Manager</dt>
      <dd>{{ jobInformation().reportingManagerName || 'Unassigned' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Hire Date</dt>
      <dd>{{ jobInformation().hireDate }}</dd>
    </dl>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobInfoComponent {
  readonly jobInformation = input.required<EmployeeDetailJobInformation>();
}
