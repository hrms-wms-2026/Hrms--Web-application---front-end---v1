import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeListItemResponse } from '../../models/employee.model';

/**
 * Minimal read-only detail view for this slice - GET /api/v1/employees/{id} is implemented,
 * but the full section-by-section detail UI (Personal Info, Emergency Contact, Payroll,
 * Policy/Access Overrides, Documents, Lifecycle) from the product spec is out of scope here
 * and documented as a known gap in EMPLOYEE_MANAGEMENT_FRONTEND_IMPLEMENTATION_REPORT.md.
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [RouterLink, ErrorStateComponent, LoaderComponent, PageHeaderComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading employee…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <app-page-header [title]="employee.fullName" [subtitle]="employee.email">
        <a routerLink="/people/employees">
          <span class="text-sm font-medium text-[var(--color-accent)] hover:underline">Back to Employees</span>
        </a>
      </app-page-header>

      <dl class="grid max-w-2xl grid-cols-2 gap-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Employee number</dt>
        <dd>{{ employee.employeeNumber }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Position</dt>
        <dd>{{ employee.positionName || '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Department</dt>
        <dd>{{ employee.departmentName || '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Legal Entity</dt>
        <dd>{{ employee.legalEntityName || '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Employment Type</dt>
        <dd>{{ employee.employmentTypeLabel }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Status</dt>
        <dd class="capitalize">{{ employee.status }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Reporting Manager</dt>
        <dd>{{ employee.reportingManagerName || 'Unassigned' }}</dd>
      </dl>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PeopleApiService);

  readonly employee = signal<EmployeeListItemResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.getEmployee(id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'The employee or selected organization record could not be found.'));
      }
    });
  }
}
