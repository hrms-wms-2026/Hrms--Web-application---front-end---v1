import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { OverviewAttendanceWidgetComponent } from '../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewTimeOffWidgetComponent } from '../../ui/overview-time-off-widget/overview-time-off-widget.component';

/**
 * Overview tab. Owns the month selection (its own EmployeePeriodStore instance, so it resets per
 * employee page). Each widget loads independently; Time Off is year-based and ignores the month.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    OverviewAttendanceWidgetComponent,
    OverviewDisciplineWidgetComponent,
    OverviewTimeOffWidgetComponent
  ],
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Attendance for the selected month</p>
      <app-employee-period-picker />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-attendance-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-time-off-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4">
      <app-overview-discipline-widget [employeeId]="employeeId()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  readonly employeeId = input.required<string>();
}
