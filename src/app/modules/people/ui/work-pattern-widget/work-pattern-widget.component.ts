import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, formatDurationCompact } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-work-pattern-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Pattern"
      [state]="loader.state()"
      emptyMessage="Activity monitoring is off for this employee."
      errorMessage="Could not load the work pattern."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div data-testid="pattern-focus">
            <dt class="text-xs text-[var(--color-text-secondary)]">Focused work blocks</dt>
            <dd class="text-lg font-semibold text-[var(--color-text-primary)]">{{ d.focusBlocks }}</dd>
            <dd class="text-xs text-[var(--color-text-secondary)]">(&ge; 30 min)</dd>
          </div>
          <div data-testid="pattern-top-app">
            <dt class="text-xs text-[var(--color-text-secondary)]">Top application</dt>
            <dd class="truncate text-lg font-semibold text-[var(--color-text-primary)]">{{ d.topApp ?? '—' }}</dd>
            @if (d.topApp) {
              <dd class="text-xs text-[var(--color-text-secondary)]">{{ fmt(d.topAppMinutes) }}</dd>
            }
          </div>
          <div data-testid="pattern-idle">
            <dt class="text-xs text-[var(--color-text-secondary)]">Longest idle period</dt>
            @if (d.longestIdle; as idle) {
              <dd class="text-lg font-semibold text-[var(--color-text-primary)]">{{ fmt(idle.minutes) }}</dd>
              <dd class="text-xs text-[var(--color-text-secondary)]">({{ clock(idle.start) }} – {{ clock(idle.end) }})</dd>
            } @else {
              <dd class="text-lg font-semibold text-[var(--color-text-primary)]">—</dd>
            }
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityWorkPattern(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => !d.activityMonitoringEnabled }
  );

  fmt(minutes: number): string {
    return formatDurationCompact(minutes);
  }

  clock(iso: string): string {
    return formatClock(iso);
  }
}
