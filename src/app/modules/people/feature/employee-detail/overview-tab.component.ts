import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from '../../ui/employee-compare-picker/employee-compare-picker.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { OverviewActivityWidgetComponent } from '../../ui/overview-activity-widget/overview-activity-widget.component';
import { OverviewApprovalsWidgetComponent } from '../../ui/overview-approvals-widget/overview-approvals-widget.component';
import { OverviewAttendanceWidgetComponent } from '../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDeliveryWidgetComponent } from '../../ui/overview-delivery-widget/overview-delivery-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewTimeOffWidgetComponent } from '../../ui/overview-time-off-widget/overview-time-off-widget.component';
import { OverviewWorkWidgetComponent } from '../../ui/overview-work-widget/overview-work-widget.component';

/**
 * Overview tab. Owns the month selection and the optional previous-period comparison (its own
 * EmployeePeriodStore instance, so both reset per employee page). Every widget loads independently.
 * All read the month except Time Off (year-based); only Activity, Attendance Discipline and Delivery
 * use the comparison.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    EmployeeComparePickerComponent,
    OverviewAttendanceWidgetComponent,
    OverviewTimeOffWidgetComponent,
    OverviewWorkWidgetComponent,
    OverviewApprovalsWidgetComponent,
    OverviewActivityWidgetComponent,
    OverviewDisciplineWidgetComponent,
    OverviewDeliveryWidgetComponent
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Activity for the selected period</p>
      <div class="flex flex-wrap items-center gap-2">
        <app-employee-period-picker />
        <app-employee-compare-picker />
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-attendance-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-time-off-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-work-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-approvals-widget [employeeId]="employeeId()" />
    </div>

    <section class="mt-6" aria-labelledby="insights-heading">
      <h2 id="insights-heading" class="text-base font-semibold text-[var(--color-text-primary)]">Productivity &amp; Work Insights</h2>
      <p class="text-sm text-[var(--color-text-secondary)]">A period-based view of activity, attendance discipline and delivery.</p>
      <div class="mt-3 grid gap-4 lg:grid-cols-3">
        <app-overview-activity-widget [employeeId]="employeeId()" />
        <app-overview-discipline-widget [employeeId]="employeeId()" />
        <app-overview-delivery-widget [employeeId]="employeeId()" />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  readonly employeeId = input.required<string>();
}
