import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { employeeInitials } from '../../utils/employee-detail.utils';
import { DetailIconComponent } from '../detail-kit/detail-icon.component';

/**
 * Identity banner shared by every employee detail tab: avatar, name, employee number,
 * position/department/company, email, and the key employment facts. Header actions are
 * projected through `[header-actions]` so permission logic stays in the feature shell.
 */
@Component({
  selector: 'app-employee-profile-header',
  standalone: true,
  imports: [DatePipe, DetailIconComponent],
  template: `
    <section class="header" aria-label="Employee profile">
      <div class="identity">
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
        <div class="min-w-0">
          <div class="name-row">
            <h1 class="name" data-testid="employee-name">{{ fullName() }}</h1>
            <span class="number">{{ job().employeeNumber }}</span>
          </div>
          <p class="position">{{ job().positionName || 'Unassigned Position' }}</p>
          <p class="org">
            <span>{{ job().departmentName || 'No department' }}</span>
            <span class="org__dot" aria-hidden="true">•</span>
            <span>{{ job().legalEntityName || 'Company' }}</span>
          </p>
          <p class="email">
            <app-detail-icon name="mail" [size]="18" />
            <span class="truncate">{{ employee().personalInformation.email }}</span>
          </p>
        </div>
      </div>

      <dl class="facts">
        <div class="fact">
          <dt><app-detail-icon name="users" [size]="18" />Reporting Manager</dt>
          <dd>
            @if (job().reportingManagerName; as manager) {
              <span class="manager-avatar" aria-hidden="true">{{ managerInitials() }}</span>{{ manager }}
            } @else {
              Unassigned
            }
          </dd>
        </div>
        <div class="fact">
          <dt><app-detail-icon name="id-card" [size]="18" />Employment Type</dt>
          <dd>{{ job().employmentTypeLabel || '—' }}</dd>
        </div>
        <div class="fact">
          <dt><app-detail-icon name="building" [size]="18" />Work Mode</dt>
          <dd>{{ job().workModeLabel || '—' }}</dd>
        </div>
        <div class="fact">
          <dt><app-detail-icon name="calendar" [size]="18" />Hire Date</dt>
          <dd>{{ job().hireDate ? (job().hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
        </div>
      </dl>

      <div class="actions">
        <ng-content select="[header-actions]" />
      </div>
    </section>
  `,
  styles: [`
    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
      padding: 1.5rem 1.75rem;
      border: 1px solid var(--color-border);
      border-radius: 0.875rem;
      background: var(--color-surface);
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
    }
    @media (min-width: 1100px) {
      .header { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) auto; align-items: center; }
      .facts { border-left: 1px solid var(--color-border); padding-left: 1.75rem; }
    }
    .identity { display: flex; align-items: center; gap: 1.75rem; min-width: 0; }
    .avatar {
      flex-shrink: 0; width: 6rem; height: 6rem; border-radius: 9999px;
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem; font-weight: 700; letter-spacing: 0.02em;
      background: #dbe7fd; color: #1d4ed8;
    }
    .name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.875rem; }
    .name { margin: 0; font-size: 1.75rem; font-weight: 700; line-height: 1.2; color: var(--color-text-primary); }
    .number {
      font-size: 0.8125rem; font-weight: 600; padding: 0.1875rem 0.625rem; border-radius: 0.375rem;
      background: #eef4ff; color: #1e3a8a; border: 1px solid #c7d7fb;
    }
    .position { margin: 0.25rem 0 0; font-size: 1.125rem; font-weight: 500; color: var(--color-text-primary); }
    .org { margin: 0.25rem 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; font-size: 0.9375rem; color: #5b6b86; }
    .org__dot { color: #94a3b8; }
    .email { margin: 0.5rem 0 0; display: flex; align-items: center; gap: 0.625rem; font-size: 0.9375rem; color: var(--color-text-primary); min-width: 0; }
    .email app-detail-icon { color: var(--color-accent); }
    .facts { margin: 0; display: grid; gap: 0.5rem; font-size: 0.9375rem; }
    .fact { display: grid; grid-template-columns: minmax(10rem, auto) minmax(0, 1fr); align-items: center; gap: 1.5rem; }
    .fact dt { display: flex; align-items: center; gap: 0.75rem; color: #5b6b86; }
    .fact dd { margin: 0; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; color: var(--color-text-primary); min-width: 0; }
    .manager-avatar {
      display: inline-flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; border-radius: 9999px;
      font-size: 0.6875rem; font-weight: 700; background: #dbe7fd; color: #1d4ed8; flex-shrink: 0;
    }
    .actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; align-self: start; }
    @media (min-width: 1100px) { .actions { justify-content: flex-end; } }
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
  readonly managerInitials = computed(() => {
    const [first, ...rest] = (this.job().reportingManagerName ?? '').trim().split(/\s+/);
    return employeeInitials(first, rest.pop());
  });
}
