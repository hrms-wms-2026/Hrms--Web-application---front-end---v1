import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { UpdateEmployeeJobDetailsRequest } from '../../../models/employee.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';
import { EmployeeJobInfoComponent } from '../../../ui/employee-job-info/employee-job-info.component';
import { EmployeeJobJourneyComponent } from '../../../ui/employee-job-journey/employee-job-journey.component';
import { calculateTenure, primaryLocation, probationStatus } from '../../../utils/employee-detail.utils';

/**
 * Employment tab: editable job details, work arrangement, employment record, the projects the
 * viewer shares with this employee, and the position history timeline.
 */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [DatePipe, EmployeeJobInfoComponent, EmployeeJobJourneyComponent],
  template: `
    @if (store.employee(); as employee) {
      <div class="flex flex-col gap-4">
        <header class="detail-card">
          <h2 class="detail-card__title m-0">Employment</h2>
          <p class="m-0 text-sm text-[var(--color-text-secondary)]">Detailed job, organization and employment record for this employee.</p>
        </header>

        <div class="grid gap-4 lg:grid-cols-3">
          <section class="detail-card" aria-label="Job and organizational details">
            <app-employee-job-info
              [jobInformation]="employee.jobInformation"
              [employeeId]="employee.id"
              [canEdit]="canEdit()"
              [saving]="store.savingJobDetails()"
              (save)="onJobDetailsSave($event)"
            />
          </section>

          <section class="detail-card" aria-labelledby="work-arrangement">
            <h2 id="work-arrangement" class="detail-card__title">Work Arrangement</h2>
            <dl class="detail-list">
              <dt>Work Mode</dt><dd>{{ employee.jobInformation.workModeLabel || '—' }}</dd>
              <dt>Primary Location</dt><dd>{{ location() }}</dd>
              <dt>Time Zone</dt><dd data-testid="employment-timezone">{{ employee.jobInformation.timezone || '—' }}</dd>
            </dl>
          </section>

          <section class="detail-card" aria-labelledby="employment-record">
            <h2 id="employment-record" class="detail-card__title">Employment Record</h2>
            <dl class="detail-list">
              <dt>Status</dt>
              <dd><span class="status-badge capitalize" [class.status-badge--ok]="employee.jobInformation.status.toLowerCase() === 'active'">{{ employee.jobInformation.status || '—' }}</span></dd>
              <dt>Hire Date</dt><dd>{{ employee.jobInformation.hireDate ? (employee.jobInformation.hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
              <dt>Tenure</dt><dd>{{ tenure() }}</dd>
              <dt>Probation</dt>
              <dd data-testid="probation-status">
                @switch (probation()) {
                  @case ('completed') { <span class="status-badge status-badge--ok">Completed</span> }
                  @case ('in_progress') { <span class="status-badge status-badge--warn">In progress</span> }
                  @default { — }
                }
              </dd>
              @if (employee.jobInformation.probationEndDate; as probationEnd) {
                <dt>Probation Ends</dt><dd>{{ probationEnd | date: 'dd MMM yyyy' }}</dd>
              }
            </dl>
          </section>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <section class="detail-card" aria-labelledby="project-memberships">
            <h2 id="project-memberships" class="detail-card__title">Project Memberships</h2>
            @if (projects().length === 0) {
              <p class="text-sm text-[var(--color-text-secondary)]" data-testid="no-shared-projects">
                No projects you share with this employee.
              </p>
            } @else {
              <table class="membership-table">
                <thead>
                  <tr><th scope="col">Project</th><th scope="col">Since</th><th scope="col">Status</th></tr>
                </thead>
                <tbody>
                  @for (project of projects(); track project.projectId) {
                    <tr data-testid="project-membership-row">
                      <td>{{ project.projectName }}</td>
                      <td>{{ project.memberSince | date: 'dd MMM yyyy' }}</td>
                      <td>
                        <span class="status-badge" [class.status-badge--ok]="project.isActive">{{ project.isActive ? 'Active' : 'Removed' }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="detail-card" aria-label="Employment history">
            <app-employee-job-journey [entries]="store.jobJourney()" />
          </section>
        </div>
      </div>
    }
  `,
  styleUrl: './employee-detail-tab.css',
  styles: [`
    .status-badge { display: inline-block; padding: 0.125rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .status-badge--ok { background: #dcfce7; color: #15803d; }
    .status-badge--warn { background: #fef3c7; color: #b45309; }
    .membership-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .membership-table th { text-align: left; font-weight: 500; font-size: 0.8125rem; color: var(--color-text-secondary); padding: 0.5rem 0.75rem; background: var(--color-surface-secondary); }
    .membership-table td { padding: 0.75rem; border-top: 1px solid var(--color-border); color: var(--color-text-primary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
  private readonly permissionService = inject(PermissionService);
  private readonly offboardingStore = inject(OffboardingWizardStore);

  readonly canEdit = computed(
    () => this.permissionService.hasPermission('employees:write') && this.offboardingStore.record()?.status !== 'completed'
  );
  readonly tenure = computed(() => calculateTenure(this.store.employee()?.jobInformation.hireDate));
  readonly location = computed(() => primaryLocation(this.store.employee()?.personalInformation.addresses));
  readonly probation = computed(() => probationStatus(this.store.employee()?.jobInformation.probationEndDate));
  readonly projects = computed(() => this.store.employee()?.projectMemberships ?? []);

  onJobDetailsSave(payload: UpdateEmployeeJobDetailsRequest): void {
    void this.store.saveJobDetails(payload);
  }
}
