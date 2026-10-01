import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { Delta, computeDelta, formatMinutes } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Activity"
      [state]="loader.state()"
      [emptyMessage]="emptyText()"
      errorMessage="Could not load activity."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Active time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-active">{{ minutes(d.activeMinutes) }}</span>
              <span data-testid="activity-active-delta"><app-delta-badge [delta]="activeDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Idle time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-idle">{{ minutes(d.idleMinutes) }}</span>
              <span data-testid="activity-idle-delta"><app-delta-badge [delta]="idleDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Meeting time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-meeting">{{ minutes(d.meetingMinutes) }}</span>
              <span data-testid="activity-meeting-delta"><app-delta-badge [delta]="meetingDelta(d)" /></span>
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-xs text-[var(--color-text-secondary)]">Based on {{ d.daysWithData }} {{ d.daysWithData === 1 ? 'day' : 'days' }} of recorded activity</p>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewActivity(this.employeeId(), this.period.from(), this.period.to(), this.period.comparePrevious()),
    { isEmpty: (v) => !v.activityMonitoringEnabled || v.daysWithData === 0 }
  );

  minutes = formatMinutes;

  emptyText(): string {
    const d = this.loader.data();
    return d && !d.activityMonitoringEnabled
      ? 'Activity monitoring is not enabled for this employee.'
      : 'No activity recorded for this period.';
  }

  activeDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.activeMinutes, d.previous.activeMinutes, 'higher-better', formatMinutes) : null;
  }

  idleDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.idleMinutes, d.previous.idleMinutes, 'lower-better', formatMinutes) : null;
  }

  meetingDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.meetingMinutes, d.previous.meetingMinutes, 'neutral', formatMinutes) : null;
  }
}
