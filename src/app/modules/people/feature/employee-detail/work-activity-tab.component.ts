import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { AppUsageWidgetComponent } from '../../ui/app-usage-widget/app-usage-widget.component';
import { DeliveryHealthWidgetComponent } from '../../ui/delivery-health-widget/delivery-health-widget.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { NeedsAttentionWidgetComponent } from '../../ui/needs-attention-widget/needs-attention-widget.component';
import { RecentTasksWidgetComponent } from '../../ui/recent-tasks-widget/recent-tasks-widget.component';
import { RecordedActivityWidgetComponent } from '../../ui/recorded-activity-widget/recorded-activity-widget.component';
import { WorkPatternWidgetComponent } from '../../ui/work-pattern-widget/work-pattern-widget.component';
import { WorkSummaryWidgetComponent } from '../../ui/work-summary-widget/work-summary-widget.component';

/**
 * Work & Activity tab. Owns its own EmployeePeriodStore instance (month resets per employee
 * page, like the Overview tab). Does not reuse the Overview tab's Work/Delivery/Activity widget
 * components directly (those are shared with Overview and must keep their own look) - instead
 * this tab's own composite cards (WorkSummary, DeliveryHealth, RecordedActivity) call the same
 * getOverviewWork/getOverviewDelivery/getOverviewActivity endpoints through their own independent
 * loaders. Needs attention, Recent tasks and Application usage are "now" cards that ignore the
 * month. Every card loads independently from its own endpoint(s) - no mock data.
 */
@Component({
  selector: 'app-employee-work-activity-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    WorkSummaryWidgetComponent,
    NeedsAttentionWidgetComponent,
    DeliveryHealthWidgetComponent,
    RecordedActivityWidgetComponent,
    RecentTasksWidgetComponent,
    AppUsageWidgetComponent,
    WorkPatternWidgetComponent
  ],
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Work and activity for the selected month</p>
      <app-employee-period-picker />
    </div>

    <app-work-summary-widget [employeeId]="employeeId()" />

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-needs-attention-widget [employeeId]="employeeId()" />
      </div>
      <app-delivery-health-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <app-recorded-activity-widget [employeeId]="employeeId()" />
      <app-recent-tasks-widget [employeeId]="employeeId()" />
      <div class="grid gap-4">
        <app-app-usage-widget [employeeId]="employeeId()" />
        <app-work-pattern-widget [employeeId]="employeeId()" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkActivityTabComponent {
  readonly employeeId = input.required<string>();
}
