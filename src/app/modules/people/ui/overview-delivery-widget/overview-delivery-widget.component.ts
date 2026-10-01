import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDeliveryResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { Delta, computeDelta } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-overview-delivery-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Delivery"
      [state]="loader.state()"
      errorMessage="Could not load delivery."
      emptyMessage="No tasks in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Tasks completed</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="delivery-tasks">{{ d.tasksCompleted }} / {{ d.tasksAssigned }}</span>
              <span data-testid="delivery-tasks-delta"><app-delta-badge [delta]="tasksDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">On-time completion</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]" data-testid="delivery-ontime">{{ d.onTimeCompleted }} / {{ d.completedWithDueDate }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Story points</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="delivery-points">{{ d.storyPointsCompleted }} / {{ d.storyPointsAssigned }}</span>
              <span data-testid="delivery-points-delta"><app-delta-badge [delta]="pointsDelta(d)" /></span>
            </dd>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDeliveryWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), this.period.comparePrevious()),
    { isEmpty: (v) => v.tasksAssigned === 0 }
  );

  tasksDelta(d: EmployeeDeliveryResponse): Delta | null {
    return d.previous ? computeDelta(d.tasksCompleted, d.previous.tasksCompleted, 'higher-better') : null;
  }

  pointsDelta(d: EmployeeDeliveryResponse): Delta | null {
    return d.previous ? computeDelta(d.storyPointsCompleted, d.previous.storyPointsCompleted, 'higher-better') : null;
  }
}
