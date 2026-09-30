import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { UpdateEmployeeJobDetailsRequest } from '../../../models/employee.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';
import { EmployeeJobInfoComponent } from '../../../ui/employee-job-info/employee-job-info.component';
import { EmployeeJobJourneyComponent } from '../../../ui/employee-job-journey/employee-job-journey.component';
import { calculateTenure } from '../../../utils/employee-detail.utils';

/** Employment tab: editable job details, employment record, and the position history timeline. */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [DatePipe, EmployeeJobInfoComponent, EmployeeJobJourneyComponent],
  template: `
    @if (store.employee(); as employee) {
      <div class="grid gap-4 lg:grid-cols-3">
        <section class="detail-card lg:col-span-2" aria-label="Job and organizational details">
          <app-employee-job-info
            [jobInformation]="employee.jobInformation"
            [employeeId]="employee.id"
            [canEdit]="canEdit()"
            [saving]="store.savingJobDetails()"
            (save)="onJobDetailsSave($event)"
          />
        </section>

        <section class="detail-card" aria-labelledby="employment-record">
          <h2 id="employment-record" class="detail-card__title">Employment Record</h2>
          <dl class="detail-list">
            <dt>Status</dt><dd class="capitalize">{{ employee.jobInformation.status || '—' }}</dd>
            <dt>Hire Date</dt><dd>{{ employee.jobInformation.hireDate ? (employee.jobInformation.hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
            <dt>Tenure</dt><dd>{{ tenure() }}</dd>
            <dt>Probation Ends</dt>
            <dd>{{ employee.jobInformation.probationEndDate ? (employee.jobInformation.probationEndDate | date: 'dd MMM yyyy') : '—' }}</dd>
          </dl>
        </section>

        <section class="detail-card lg:col-span-3" aria-label="Employment history">
          <app-employee-job-journey [entries]="store.jobJourney()" />
        </section>
      </div>
    }
  `,
  styleUrl: './employee-detail-tab.css',
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

  onJobDetailsSave(payload: UpdateEmployeeJobDetailsRequest): void {
    void this.store.saveJobDetails(payload);
  }
}
