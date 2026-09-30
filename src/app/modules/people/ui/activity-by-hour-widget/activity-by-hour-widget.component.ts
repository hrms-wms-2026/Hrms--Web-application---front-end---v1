import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, hourLabel, visibleHours } from '../../utils/employee-work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

/** Activity by time of day - the one exception to UTC-day bucketing (Plan 4B): the backend
 * already converts to the employee's legal-entity timezone, so this widget only renders it. */
@Component({
  selector: 'app-activity-by-hour-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Activity by time of day"
      [state]="loader.state()"
      emptyMessage="Activity monitoring is off for this employee."
      errorMessage="Could not load activity by hour."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <p class="mb-2 text-xs text-[var(--color-text-secondary)]" data-testid="last-activity">
          Last activity: {{ clock(d.lastActivityAt, d.timezone) }}
        </p>
        <app-work-activity-bar-chart [bars]="bars()" ariaLabel="Active minutes by hour of day" />
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityByHourWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityByHour(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => !d.activityMonitoringEnabled }
  );

  readonly bars = computed(() => {
    const d = this.loader.data();
    if (!d) return [];
    return visibleHours(d.hours).map((h) => ({ label: hourLabel(h.hour), value: h.activeMinutes }));
  });

  clock(iso: string | null, timeZone: string): string {
    return formatClock(iso, timeZone);
  }
}
