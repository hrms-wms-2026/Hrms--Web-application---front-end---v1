import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MetricStatComponent } from '../../../../shared/ui/metric-stat/metric-stat.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatDurationCompact, formatClock, hourLabel, visibleHours } from '../../utils/employee-work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

/**
 * Active/idle/meeting time from getOverviewActivity plus last-activity timestamp and the hourly
 * chart from getWorkActivityByHour - two independent loaders. The card's own loading/error/empty
 * state follows `activity` alone (the period-scoped totals every reader of this card wants);
 * `byHour`'s "Last activity" stat and the hourly chart render only once byHour is itself ready, so
 * a failure on that one endpoint doesn't blank the whole card.
 */
@Component({
  selector: 'app-recorded-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent, MetricStatComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Recorded Activity"
      [state]="activity.state()"
      emptyMessage="Activity monitoring is not enabled for this employee."
      errorMessage="Could not load recorded activity."
      (retry)="activity.reload()"
    >
      <p class="-mt-2 mb-4 text-sm text-[var(--color-text-secondary)]">Based on device activity for the selected period</p>

      @if (activity.data(); as a) {
        <div class="flex flex-wrap gap-x-8 gap-y-4">
          <app-metric-stat icon="monitor" tone="green" [value]="duration(a.activeMinutes)" label="Active time" />
          <app-metric-stat icon="clock" tone="amber" [value]="duration(a.idleMinutes)" label="Idle time" />
          <app-metric-stat icon="users" tone="violet" [value]="duration(a.meetingMinutes)" label="Meeting time" />
          @if (byHour.state() === 'ready' && byHour.data(); as h) {
            <app-metric-stat icon="clock" tone="blue" [value]="clock(h.lastActivityAt, h.timezone)" label="Last activity" />
          }
        </div>
      }

      @if (byHour.state() === 'ready' && byHour.data(); as h) {
        <div class="mt-5 border-t border-[var(--color-border)] pt-3">
          <p class="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Activity by time of day</p>
          <app-work-activity-bar-chart [bars]="bars()" ariaLabel="Active minutes by hour of day" />
        </div>
      } @else if (byHour.state() === 'error') {
        <p class="mt-5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
          Could not load activity by time of day.
        </p>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordedActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly activity = createWidgetLoader(
    () => this.api.getOverviewActivity(this.employeeId(), this.period.from(), this.period.to(), false),
    { isEmpty: (v) => !v.activityMonitoringEnabled }
  );

  readonly byHour = createWidgetLoader(() => this.api.getWorkActivityByHour(this.employeeId(), this.period.from(), this.period.to()));

  readonly bars = computed(() => {
    const d = this.byHour.data();
    if (!d) return [];
    return visibleHours(d.hours).map((h) => ({ label: hourLabel(h.hour), value: h.activeMinutes }));
  });

  duration = formatDurationCompact;

  clock(iso: string | null, timeZone: string): string {
    return formatClock(iso, timeZone);
  }
}
