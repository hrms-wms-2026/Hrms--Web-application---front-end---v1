import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailJobInformation } from '../../models/employee.model';

@Component({
  selector: 'app-employee-job-info',
  standalone: true,
  template: `
    <div>
      <h3 class="text-sm font-semibold text-[var(--color-text-primary)] pb-3 mb-4 border-b border-[var(--color-border)]">
        Job & Organizational Details
      </h3>
      <dl class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Employee Number</dt>
          <dd class="font-semibold text-[var(--color-text-primary)] font-mono text-xs bg-[var(--color-surface-secondary)] px-2.5 py-1 rounded-md inline-block">
            {{ jobInformation().employeeNumber }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Position</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().positionName || 'Unassigned' }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Department</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().departmentName || 'Unassigned' }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Company</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().legalEntityName || '—' }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Employment Type</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().employmentTypeLabel }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</dt>
          <dd class="inline-flex items-center gap-1.5 font-semibold text-xs capitalize px-2.5 py-1 rounded-full"
              [class.bg-green-100]="jobInformation().status.toLowerCase() === 'active'"
              [class.text-green-800]="jobInformation().status.toLowerCase() === 'active'"
              [class.bg-red-100]="jobInformation().status.toLowerCase() === 'inactive'"
              [class.text-red-800]="jobInformation().status.toLowerCase() === 'inactive'">
            <span class="w-1.5 h-1.5 rounded-full"
                  [class.bg-green-600]="jobInformation().status.toLowerCase() === 'active'"
                  [class.bg-red-600]="jobInformation().status.toLowerCase() === 'inactive'"></span>
            {{ jobInformation().status }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Reporting Manager</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().reportingManagerName || 'Unassigned' }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Work Mode</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().workModeLabel || '—' }}
          </dd>
        </div>

        <div>
          <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Hire Date</dt>
          <dd class="font-semibold text-[var(--color-text-primary)]">
            {{ jobInformation().hireDate }}
          </dd>
        </div>
      </dl>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobInfoComponent {
  readonly jobInformation = input.required<EmployeeDetailJobInformation>();
}
