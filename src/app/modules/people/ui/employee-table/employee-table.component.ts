import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { EmployeeListItemResponse } from '../../models/employee.model';

/**
 * Presentational only - no API calls (per ONEVO_HRMS_Frontend_Architecture.md's ui/ rule).
 * Schedule/Shift is intentionally not a column here: no work_schedules backend source exists
 * in this slice (see EMPLOYEE_MANAGEMENT_FRONTEND_IMPLEMENTATION_REPORT.md), so showing an
 * always-empty column would be worse than omitting it.
 */
@Component({
  selector: 'app-employee-table',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    @if (employees().length === 0) {
      <app-empty-state title="No employees found" description="Try adjusting your search or filters." />
    } @else {
      <div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table class="w-full text-left text-sm">
          <thead class="bg-[var(--color-surface-secondary)] text-xs font-medium text-[var(--color-text-secondary)]">
            <tr>
              <th class="px-4 py-3">Employee</th>
              <th class="px-4 py-3">Position</th>
              <th class="px-4 py-3">Department</th>
              <th class="px-4 py-3">Legal Entity</th>
              <th class="px-4 py-3">Employment Type</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Reporting Manager</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            @for (employee of employees(); track employee.id) {
              <tr>
                <td class="px-4 py-3">
                  <div class="font-medium text-[var(--color-text-primary)]">{{ employee.fullName }}</div>
                  <div class="text-xs text-[var(--color-text-secondary)]">{{ employee.email }}</div>
                </td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ employee.positionName || '—' }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ employee.departmentName || '—' }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ employee.legalEntityName || '—' }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ employee.employmentTypeLabel }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs capitalize">{{
                    employee.status
                  }}</span>
                </td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">
                  {{ employee.reportingManagerName || 'Unassigned' }}
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    [routerLink]="['/people/employees', employee.id]"
                    class="text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class EmployeeTableComponent {
  employees = input.required<readonly EmployeeListItemResponse[]>();
}
