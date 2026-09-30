import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { employeeInitials } from '../../utils/employee-detail.utils';

/**
 * Identity banner shared by every employee detail tab: avatar, name, employee number,
 * position/department/company, email, and the key employment facts. Header actions are
 * projected through `[header-actions]` so permission logic stays in the feature shell.
 */
@Component({
  selector: 'app-employee-profile-header',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="profile-header" aria-label="Employee profile">
      <div class="profile-identity">
        <div class="profile-avatar" aria-hidden="true">{{ initials() }}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)]" data-testid="employee-name">{{ fullName() }}</h1>
            <span class="profile-number">{{ job().employeeNumber }}</span>
          </div>
          <p class="text-base font-medium text-[var(--color-text-primary)] mt-0.5">
            {{ job().positionName || 'Unassigned Position' }}
          </p>
          <p class="text-sm text-[var(--color-accent)] mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{{ job().departmentName || 'No department' }}</span>
            <span aria-hidden="true">•</span>
            <span>{{ job().legalEntityName || 'Company' }}</span>
          </p>
          <p class="text-sm text-[var(--color-text-secondary)] mt-1 truncate">{{ employee().personalInformation.email }}</p>
        </div>
      </div>

      <dl class="profile-facts">
        <dt>Reporting Manager</dt>
        <dd>{{ job().reportingManagerName || 'Unassigned' }}</dd>
        <dt>Employment Type</dt>
        <dd>{{ job().employmentTypeLabel || '—' }}</dd>
        <dt>Work Mode</dt>
        <dd>{{ job().workModeLabel || '—' }}</dd>
        <dt>Hire Date</dt>
        <dd>{{ job().hireDate ? (job().hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
      </dl>

      <div class="profile-actions">
        <ng-content select="[header-actions]" />
      </div>
    </section>
  `,
  styles: [`
    .profile-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
      padding: 1.5rem;
      border: 1px solid var(--color-border);
      border-radius: 1rem;
      background: var(--color-surface);
    }
    @media (min-width: 1024px) {
      .profile-header { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; align-items: center; }
      .profile-facts { border-left: 1px solid var(--color-border); padding-left: 1.5rem; }
    }
    .profile-identity { display: flex; align-items: center; gap: 1.25rem; min-width: 0; }
    .profile-avatar {
      flex-shrink: 0;
      width: 5.5rem;
      height: 5.5rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      color: var(--color-accent);
    }
    .profile-number {
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.625rem;
      border-radius: 0.375rem;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }
    .profile-facts {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 1.5rem;
      row-gap: 0.375rem;
      margin: 0;
      font-size: 0.875rem;
    }
    .profile-facts dt { color: var(--color-text-secondary); }
    .profile-facts dd { margin: 0; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .profile-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; align-self: start; }
    @media (min-width: 1024px) { .profile-actions { justify-content: flex-end; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeProfileHeaderComponent {
  readonly employee = input.required<EmployeeDetailResponse>();

  readonly job = computed(() => this.employee().jobInformation);
  readonly fullName = computed(() => {
    const info = this.employee().personalInformation;
    return `${info.firstName} ${info.lastName}`.trim();
  });
  readonly initials = computed(() => {
    const info = this.employee().personalInformation;
    return employeeInitials(info.firstName, info.lastName);
  });
}
