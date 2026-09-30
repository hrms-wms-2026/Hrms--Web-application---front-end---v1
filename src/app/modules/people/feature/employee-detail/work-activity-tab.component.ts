import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { ActivityByHourWidgetComponent } from '../../ui/activity-by-hour-widget/activity-by-hour-widget.component';
import { AppUsageWidgetComponent } from '../../ui/app-usage-widget/app-usage-widget.component';
import { DeliveryTrendWidgetComponent } from '../../ui/delivery-trend-widget/delivery-trend-widget.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { NeedsAttentionWidgetComponent } from '../../ui/needs-attention-widget/needs-attention-widget.component';
import { OverviewActivityWidgetComponent } from '../../ui/overview-activity-widget/overview-activity-widget.component';
import { OverviewDeliveryWidgetComponent } from '../../ui/overview-delivery-widget/overview-delivery-widget.component';
import { OverviewWorkWidgetComponent } from '../../ui/overview-work-widget/overview-work-widget.component';
import { RecentTasksWidgetComponent } from '../../ui/recent-tasks-widget/recent-tasks-widget.component';
import { WorkPatternWidgetComponent } from '../../ui/work-pattern-widget/work-pattern-widget.component';

/**
 * Work & Activity tab. Owns its own EmployeePeriodStore instance (month resets per employee
 * page, like the Overview tab). Reuses the Overview tab's own real-data Work/Delivery/Activity
 * widgets (OverviewWorkWidgetComponent, OverviewDeliveryWidgetComponent,
 * OverviewActivityWidgetComponent) rather than rebuilding the same period-scoped task/activity
 * reads, and adds the cards this tab alone needs: Needs attention, Recent tasks (both "now"
 * cards, ignore the month), the 6-month delivery trend, the hourly activity chart, Application
 * usage and Work pattern. Every card loads independently from its own endpoint - no mock data.
 */
@Component({
  selector: 'app-employee-work-activity-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    OverviewWorkWidgetComponent,
    NeedsAttentionWidgetComponent,
    OverviewDeliveryWidgetComponent,
    DeliveryTrendWidgetComponent,
    OverviewActivityWidgetComponent,
    ActivityByHourWidgetComponent,
    RecentTasksWidgetComponent,
    AppUsageWidgetComponent,
    WorkPatternWidgetComponent
  ],
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Work and activity for the selected month</p>
      <app-employee-period-picker />
    </div>

    <app-overview-work-widget [employeeId]="employeeId()" />

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-needs-attention-widget [employeeId]="employeeId()" />
      </div>
      <div class="grid gap-4">
        <app-overview-delivery-widget [employeeId]="employeeId()" />
        <app-delivery-trend-widget [employeeId]="employeeId()" />
      </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="grid gap-4">
        <app-overview-activity-widget [employeeId]="employeeId()" />
        <app-activity-by-hour-widget [employeeId]="employeeId()" />
      </div>
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
