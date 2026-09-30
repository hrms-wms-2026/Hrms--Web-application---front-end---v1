import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { UpdateEmployeeJobDetailsRequest } from '../../../models/employee.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';
import { EmployeeJobInfoComponent } from '../../../ui/employee-job-info/employee-job-info.component';
import { EmployeeWorkNetworkComponent } from '../../../ui/employee-work-network/employee-work-network.component';
import { DetailCardComponent } from '../../../ui/detail-kit/detail-card.component';
import { DetailIconComponent } from '../../../ui/detail-kit/detail-icon.component';
import { KvRowComponent } from '../../../ui/detail-kit/kv-row.component';
import { StatusBadgeComponent } from '../../../ui/detail-kit/status-badge.component';
import { TimelineComponent, TimelineItem } from '../../../ui/detail-kit/timeline.component';
import { calculateTenure, employmentHistory, formatDayMonth, primaryLocation, probationStatus } from '../../../utils/employee-detail.utils';

/**
 * Employment tab: job & organizational details (with the inline job-details edit form),
 * work arrangement, employment record, the Work Network graph, the projects the viewer shares
 * with this employee, and the employment history timeline built from position history.
 */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [
    DatePipe,
    EmployeeJobInfoComponent,
    EmployeeWorkNetworkComponent,
    DetailCardComponent,
    DetailIconComponent,
    KvRowComponent,
    StatusBadgeComponent,
    TimelineComponent
  ],
  templateUrl: './employee-employment-tab.component.html',
  styleUrl: './employee-employment-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
  private readonly permissionService = inject(PermissionService);
  private readonly offboardingStore = inject(OffboardingWizardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly jobInfo = viewChild(EmployeeJobInfoComponent);

  readonly canEdit = computed(
    () => this.permissionService.hasPermission('employees:write') && this.offboardingStore.record()?.status !== 'completed'
  );
  readonly isEditing = computed(() => this.jobInfo()?.isEditing() ?? false);
  readonly tenure = computed(() => calculateTenure(this.store.employee()?.jobInformation.hireDate));
  readonly location = computed(() => primaryLocation(this.store.employee()?.personalInformation.addresses));
  readonly probation = computed(() => probationStatus(this.store.employee()?.jobInformation.probationEndDate));
  readonly projects = computed(() => this.store.employee()?.projectMemberships ?? []);
  readonly history = computed<TimelineItem[]>(() =>
    employmentHistory(this.store.jobJourney(), this.store.employee()?.jobInformation.probationEndDate).map((event) => ({
      date: formatDate(event.date),
      title: event.title,
      description: event.description
    }))
  );

  constructor() {
    // "Edit Employee" in the profile header lands here with ?edit=job and opens the form.
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      if (params.get('edit') !== 'job') return;
      queueMicrotask(() => {
        if (this.canEdit()) this.startEdit();
        void this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
  }

  startEdit(): void {
    this.jobInfo()?.startEdit();
  }

  async onJobDetailsSave(payload: UpdateEmployeeJobDetailsRequest): Promise<void> {
    const saved = await this.store.saveJobDetails(payload);
    if (saved) this.jobInfo()?.cancelEdit();
  }
}

function formatDate(value: string): string {
  return formatDayMonth(value, true);
}
