import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { shortMonth } from '../../utils/employee-work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

/**
 * Completion/on-time rates from getOverviewWork, task and story-point counts from
 * getOverviewDelivery, and the 6-month trend from getWorkActivityDeliveryTrend - three independent
 * loaders. The card's own loading/error/empty state follows `work` alone (the two rate figures
 * every reader of this card wants); the counts row and the trend chart render only once their own
 * loader is ready, so a failure on either doesn't blank the whole card.
 */
@Component({
  selector: 'app-delivery-health-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Delivery Health"
      [state]="work.state()"
      errorMessage="Could not load delivery health."
      emptyMessage="No tasks in this period."
      (retry)="work.reload()"
    >
      <p class="-mt-2 mb-4 text-sm text-[var(--color-text-secondary)]">Task completion and delivery performance</p>

      @if (work.data(); as w) {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="text-2xl font-semibold text-[var(--color-success)]" data-testid="delivery-health-completion-rate">{{ w.completionRatePercent }}%</p>
            <p class="text-xs text-[var(--color-text-secondary)]">Completion rate</p>
          </div>
          <div>
            <p class="text-2xl font-semibold text-[var(--color-accent)]" data-testid="delivery-health-ontime-rate">
              {{ w.onTimeRatePercent === null ? '—' : w.onTimeRatePercent + '%' }}
            </p>
            <p class="text-xs text-[var(--color-text-secondary)]">On-time completion</p>
          </div>
          @if (delivery.state() === 'ready' && delivery.data(); as d) {
            <div>
              <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="delivery-health-tasks">{{ d.tasksCompleted }} / {{ d.tasksAssigned }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">Tasks completed</p>
            </div>
            <div>
              <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="delivery-health-points">{{ d.storyPointsCompleted }} / {{ d.storyPointsAssigned }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">Story points</p>
            </div>
          }
        </div>
      }

      @if (trend.state() === 'ready' && trend.data()) {
        <div class="mt-4 border-t border-[var(--color-border)] pt-3">
          <p class="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Tasks completed (monthly)</p>
          <app-work-activity-bar-chart [bars]="bars()" ariaLabel="Tasks completed per month" />
        </div>
      } @else if (trend.state() === 'error') {
        <p class="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
          Could not load the monthly delivery trend.
        </p>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeliveryHealthWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly work = createWidgetLoader(() => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()));

  readonly delivery = createWidgetLoader(() =>
    this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), false)
  );

  readonly trend = createWidgetLoader(() => this.api.getWorkActivityDeliveryTrend(this.employeeId(), this.period.to()));

  readonly bars = computed(() => (this.trend.data()?.months ?? []).map((m) => ({ label: shortMonth(m.month), value: m.completed })));
}
