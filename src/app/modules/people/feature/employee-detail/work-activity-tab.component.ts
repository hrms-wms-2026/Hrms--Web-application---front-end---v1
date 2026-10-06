import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { AppUsageWidgetComponent } from '../../ui/app-usage-widget/app-usage-widget.component';
import { DeliveryHealthWidgetComponent } from '../../ui/delivery-health-widget/delivery-health-widget.component';
import { NeedsAttentionWidgetComponent } from '../../ui/needs-attention-widget/needs-attention-widget.component';
import { RecentTasksWidgetComponent } from '../../ui/recent-tasks-widget/recent-tasks-widget.component';
import { RecordedActivityWidgetComponent } from '../../ui/recorded-activity-widget/recorded-activity-widget.component';
import { WorkPatternWidgetComponent } from '../../ui/work-pattern-widget/work-pattern-widget.component';
import { WorkSummaryWidgetComponent } from '../../ui/work-summary-widget/work-summary-widget.component';

/**
 * Work & Activity tab, laid out like the Overview tab: KPI strip, then the delivery trend beside
 * Needs Attention, then the device-activity cards, then the recent task list. Reads the month (and
 * optional comparison month) from the EmployeePeriodStore provided by the employee detail page,
 * whose header renders the month/Compare controls for this tab too, and sets its hire/termination
 * bounds. Does not reuse the Overview tab's Work/Delivery/Activity widget components directly
 * (those are shared with Overview and must keep their own look) - this tab's own cards call the
 * same getOverviewWork/getOverviewDelivery/getOverviewActivity endpoints through their own
 * independent loaders. Needs attention and Recent tasks are "now" cards that ignore the month.
 * Every card loads independently from its own endpoint(s) - no mock data.
 */
@Component({
  selector: 'app-employee-work-activity-tab',
  standalone: true,
  imports: [
    WorkSummaryWidgetComponent,
    NeedsAttentionWidgetComponent,
    DeliveryHealthWidgetComponent,
    RecordedActivityWidgetComponent,
    RecentTasksWidgetComponent,
    AppUsageWidgetComponent,
    WorkPatternWidgetComponent
  ],
  template: `
    <!-- ROW 1: KPI strip, full width -->
    <app-work-summary-widget class="mb-6 block" [employeeId]="employeeId()" />

    <!-- ROW 2: delivery trend (2/3) + Needs Attention (1/3) -->
    <div data-testid="work-activity-delivery" class="mb-6 grid items-stretch gap-6 lg:grid-cols-3">
      <app-delivery-health-widget class="block h-full lg:col-span-2" [employeeId]="employeeId()" />
      <app-needs-attention-widget class="block h-full" [employeeId]="employeeId()" />
    </div>

    <!-- ROW 3: device activity for the month -->
    <div data-testid="work-activity-device" class="mb-6 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
      <app-recorded-activity-widget class="block h-full" [employeeId]="employeeId()" />
      <app-app-usage-widget class="block h-full" [employeeId]="employeeId()" />
      <app-work-pattern-widget class="block h-full md:col-span-2 lg:col-span-1" [employeeId]="employeeId()" />
    </div>

    <!-- ROW 4: recent tasks, full width -->
    <app-recent-tasks-widget class="mb-6 block" [employeeId]="employeeId()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkActivityTabComponent {
  readonly employeeId = input.required<string>();
  readonly hireDate = input<string | null>(null);
  readonly terminationDate = input<string | null>(null);
  private readonly store = inject(EmployeePeriodStore);

  constructor() {
    effect(() => this.store.setBounds(this.hireDate(), this.terminationDate()));
  }
}
