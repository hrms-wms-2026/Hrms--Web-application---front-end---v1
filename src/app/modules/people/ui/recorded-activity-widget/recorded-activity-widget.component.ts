import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Recorded Activity"
      [state]="activity.state()"
      emptyMessage="Activity monitoring is not enabled for this employee."
      errorMessage="Could not load recorded activity."
      (retry)="activity.reload()"
    >
      @if (byHour.state() === 'ready' && byHour.data(); as h) {
        <span widget-actions class="whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
          Last activity <span class="font-semibold text-[var(--color-text-primary)]">{{ clock(h.lastActivityAt, h.timezone) }}</span>
        </span>
      }

      <div class="flex flex-1 flex-col">
        <p class="-mt-1 mb-3 text-xs text-[var(--color-text-secondary)]">Based on device activity for the selected period</p>

        @if (activity.data(); as a) {
          <div class="grid grid-cols-3 gap-2">
            <div class="min-w-0 rounded-xl bg-[var(--color-success-subtle)] p-3">
              <p class="truncate text-xs font-medium text-[var(--color-success-text)]">Active time</p>
              <p class="mt-1 truncate text-base font-bold text-[var(--color-text-primary)]">{{ duration(a.activeMinutes) }}</p>
            </div>
            <div class="min-w-0 rounded-xl bg-[var(--color-warning-subtle)] p-3">
              <p class="truncate text-xs font-medium text-[var(--color-warning-text)]">Idle time</p>
              <p class="mt-1 truncate text-base font-bold text-[var(--color-text-primary)]">{{ duration(a.idleMinutes) }}</p>
            </div>
            <div class="min-w-0 rounded-xl bg-[var(--color-cat-violet-subtle)] p-3">
              <p class="truncate text-xs font-medium text-[var(--color-cat-violet)]">Meeting time</p>
              <p class="mt-1 truncate text-base font-bold text-[var(--color-text-primary)]">{{ duration(a.meetingMinutes) }}</p>
            </div>
          </div>
        }

        @if (byHour.state() === 'ready' && byHour.data()) {
          <div class="mt-auto pt-4">
            <p class="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Activity by time of day</p>
            <app-work-activity-bar-chart [bars]="bars()" [formatTick]="tick" ariaLabel="Active minutes by hour of day" />
          </div>
        } @else if (byHour.state() === 'error') {
          <p class="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
            Could not load activity by time of day.
          </p>
        }
      </div>
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

  /** Short y-axis label for a minute count: '2h', '1h 30m', '45m'. */
  tick(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h${m}m`;
  }

  clock(iso: string | null, timeZone: string): string {
    return formatClock(iso, timeZone);
  }
}
