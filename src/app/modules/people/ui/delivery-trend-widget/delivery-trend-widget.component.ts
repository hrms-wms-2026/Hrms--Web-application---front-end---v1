import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { shortMonth } from '../../utils/employee-work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

@Component({
  selector: 'app-delivery-trend-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Tasks completed (monthly)"
      [state]="loader.state()"
      emptyMessage="No tasks completed in these 6 months."
      errorMessage="Could not load the delivery trend."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <app-work-activity-bar-chart [bars]="bars()" ariaLabel="Tasks completed per month" />
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeliveryTrendWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() => this.api.getWorkActivityDeliveryTrend(this.employeeId(), this.period.to()), {
    isEmpty: (d) => d.months.every((m) => m.completed === 0)
  });

  readonly bars = computed(() => (this.loader.data()?.months ?? []).map((m) => ({ label: shortMonth(m.month), value: m.completed })));
}
