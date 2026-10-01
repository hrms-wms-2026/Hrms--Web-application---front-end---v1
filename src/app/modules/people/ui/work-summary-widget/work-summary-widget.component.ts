import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MetricStatComponent } from '../../../../shared/ui/metric-stat/metric-stat.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';

/**
 * Top-of-tab summary strip: assigned/completed/in-progress/overdue from getOverviewWork plus story
 * points from getOverviewDelivery - two independent loaders. The card's own loading/error/empty
 * state follows `work` alone; the Story Points stat renders only once `delivery` is itself ready,
 * so a failure on that endpoint still leaves the four work stats visible.
 */
@Component({
  selector: 'app-work-summary-widget',
  standalone: true,
  imports: [WidgetCardComponent, MetricStatComponent],
  template: `
    <app-widget-card
      title="Work Summary"
      [state]="work.state()"
      errorMessage="Could not load the work summary."
      emptyMessage="No tasks in this period."
      (retry)="retry()"
    >
      @if (work.data(); as w) {
        <div class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <p class="text-sm text-[var(--color-text-secondary)]">Track progress for the selected period</p>
          <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
            <app-metric-stat icon="clipboard-list" tone="blue" [value]="w.assigned" label="Assigned" />
            <app-metric-stat icon="check-circle" tone="green" [value]="w.completed" label="Completed" />
            <app-metric-stat icon="clock" tone="blue" [value]="w.inProgress" label="In Progress" />
            <app-metric-stat icon="alert-triangle" tone="red" [value]="w.overdue" label="Overdue" />
            @if (delivery.state() === 'ready' && delivery.data(); as d) {
              <app-metric-stat icon="layers" tone="violet" [value]="storyPoints(d)" label="Story Points" />
            }
          </div>
        </div>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkSummaryWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly work = createWidgetLoader(() => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()));

  readonly delivery = createWidgetLoader(() =>
    this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), false)
  );

  retry(): void {
    this.work.reload();
    this.delivery.reload();
  }

  storyPoints(d: { storyPointsCompleted: number; storyPointsAssigned: number }): string {
    return `${d.storyPointsCompleted} / ${d.storyPointsAssigned}`;
  }
}
