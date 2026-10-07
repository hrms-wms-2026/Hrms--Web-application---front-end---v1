import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { shortMonth } from '../../utils/employee-work-activity.utils';
import { createCompareLoader, deltaIf } from '../../utils/overview-compare';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

/**
 * Completion rate from getOverviewWork, task and story-point counts from
 * getOverviewDelivery, and the 6-month trend from getWorkActivityDeliveryTrend - three independent
 * loaders. The card's own loading/error/empty state follows `work` alone (the completion rate
 * every reader of this card wants); the counts row and the trend chart render only once their own
 * loader is ready, so a failure on either doesn't blank the whole card.
 */
@Component({
  selector: 'app-delivery-health-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Delivery Health"
      [nowrapTitle]="true"
      [state]="work.state()"
      errorMessage="Could not load delivery health."
      emptyMessage="No tasks in this period."
      (retry)="work.reload()"
    >
      <div widget-actions class="flex items-center gap-4 text-xs font-medium text-slate-600">
        @if (period.isComparing()) {
          <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
            <span class="h-1.5 w-1.5 rounded-full bg-blue-600"></span> Comparing with {{ period.compareLabel() }}
          </span>
        }
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-600"></span> Tasks completed (monthly)
        </span>
      </div>

      @if (work.data(); as w) {
        <div class="flex flex-1 flex-col">
          <p class="-mt-1 mb-4 text-xs text-slate-500">Task completion and delivery performance</p>

          <div class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 sm:divide-x sm:divide-slate-100">
            <div>
              <p class="text-xs text-slate-500">Completion rate</p>
              <p class="mt-0.5 flex items-center gap-2 text-lg font-bold text-emerald-600">
                <span data-testid="delivery-health-completion-rate">{{ w.completionRatePercent }}%</span>
                <app-delta-badge [delta]="completionDelta()" [against]="period.compareLabel()" />
              </p>
            </div>
            @if (delivery.state() === 'ready' && delivery.data(); as d) {
              <div class="sm:pl-6">
                <p class="text-xs text-slate-500">Tasks completed</p>
                <p class="mt-0.5 text-lg font-bold text-slate-900" data-testid="delivery-health-tasks">{{ d.tasksCompleted }} / {{ d.tasksAssigned }}</p>
              </div>
              <div class="sm:pl-6">
                <p class="text-xs text-slate-500">Story points</p>
                <p class="mt-0.5 text-lg font-bold text-slate-900" data-testid="delivery-health-points">{{ d.storyPointsCompleted }} / {{ d.storyPointsAssigned }}</p>
              </div>
            }
          </div>

          @if (trend.state() === 'ready' && trend.data()) {
            <div class="mt-auto pt-5">
              <app-work-activity-bar-chart [bars]="bars()" ariaLabel="Tasks completed per month" />
            </div>
          } @else if (trend.state() === 'error') {
            <p class="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Could not load the monthly delivery trend.
            </p>
          } @else if (trend.state() === 'loading') {
            <div class="mt-5 h-36 animate-pulse rounded-xl bg-slate-100" aria-hidden="true"></div>
          }
        </div>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeliveryHealthWidgetComponent {
  private readonly api = inject(PeopleApiService);
  protected readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly work = createWidgetLoader(() => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()));

  readonly delivery = createWidgetLoader(() =>
    this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), false)
  );

  readonly trend = createWidgetLoader(() => this.api.getWorkActivityDeliveryTrend(this.employeeId(), this.period.to()));

  readonly compareWork = createCompareLoader(this.period, (from, to) => this.api.getOverviewWork(this.employeeId(), from, to));

  /** Completion-rate change against the header's comparison month (null when Compare is off). */
  readonly completionDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.work.data()?.completionRatePercent, this.compareWork.data()?.completionRatePercent, 'higher-better', percent)
  );

  readonly bars = computed(() => (this.trend.data()?.months ?? []).map((m) => ({ label: shortMonth(m.month), value: m.completed })));
}

function percent(n: number): string {
  return `${n}%`;
}
