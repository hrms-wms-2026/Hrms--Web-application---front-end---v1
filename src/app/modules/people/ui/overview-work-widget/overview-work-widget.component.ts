import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-overview-work-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Management"
      [state]="loader.state()"
      errorMessage="Could not load work management."
      emptyMessage="No tasks in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-assigned">{{ d.assigned }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Assigned</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-completed">{{ d.completed }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Completed</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-in-progress">{{ d.inProgress }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">In progress</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.overdue > 0" [class.text-[var(--color-text-primary)]]="d.overdue === 0" data-testid="work-overdue">{{ d.overdue }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Overdue</dt>
          </div>
        </dl>

        <div class="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]" role="img" [attr.aria-label]="barLabel(d)">
          <span class="seg seg--completed" data-testid="seg-completed" [style.width.%]="share(d.completed, d)"></span>
          <span class="seg seg--in-progress" data-testid="seg-in-progress" [style.width.%]="share(d.inProgress, d)"></span>
          <span class="seg seg--overdue" data-testid="seg-overdue" [style.width.%]="share(d.overdue, d)"></span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-3 text-sm">
          <div>
            <p class="text-xs text-[var(--color-text-secondary)]">Completion rate</p>
            <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="work-completion-rate">{{ d.completionRatePercent }}%</p>
          </div>
          <div>
            <p class="text-xs text-[var(--color-text-secondary)]">On-time rate</p>
            <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="work-ontime-rate">{{ d.onTimeRatePercent === null ? '—' : d.onTimeRatePercent + '%' }}</p>
          </div>
        </div>
      }
    </app-widget-card>
  `,
  styles: [`
    .seg { height: 100%; display: block; }
    .seg--completed { background: #16a34a; }
    .seg--in-progress { background: #3b82f6; }
    .seg--overdue { background: #dc2626; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewWorkWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.assigned === 0 }
  );

  share(count: number, d: EmployeeWorkOverviewResponse): number {
    return d.assigned === 0 ? 0 : (count / d.assigned) * 100;
  }

  barLabel(d: EmployeeWorkOverviewResponse): string {
    return `${d.completed} completed, ${d.inProgress} in progress, ${d.overdue} overdue of ${d.assigned} assigned`;
  }
}
