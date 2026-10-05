import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAppUsageResponse } from '../../models/employee-work-activity.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, formatDurationCompact } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-app-usage-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Application Usage"
      [state]="loader.state()"
      [emptyMessage]="emptyMessage()"
      errorMessage="Could not load application usage."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <span widget-actions class="whitespace-nowrap text-[11px] text-slate-500">
          Total <span class="font-semibold text-slate-800">{{ fmt(d.totalMinutes) }}</span>
        </span>
      }
      @if (loader.data(); as d) {
        <ul class="space-y-3">
          @for (app of d.apps; track app.appName) {
            <li data-testid="app-row" class="min-w-0">
              <div class="flex items-baseline justify-between gap-3">
                <span class="truncate text-sm font-semibold text-slate-900" [title]="app.appName">{{ app.appName }}</span>
                <span class="shrink-0 text-sm font-bold tabular-nums text-slate-900">{{ fmt(app.activeMinutes) }}</span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div class="h-full rounded-full bg-blue-600" [style.width.%]="share(app.activeMinutes, d.totalMinutes)"></div>
              </div>
              <p class="mt-1 truncate text-[11px] text-slate-500">
                {{ app.sessions }} {{ app.sessions === 1 ? 'session' : 'sessions' }} · Last used {{ clock(app.lastUsedAt) }}
              </p>
            </li>
          }
        </ul>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppUsageWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityAppUsage(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d: EmployeeAppUsageResponse) => !d.applicationTrackingEnabled || d.apps.length === 0 }
  );

  emptyMessage(): string {
    const d = this.loader.data();
    return d && !d.applicationTrackingEnabled
      ? 'Application tracking is off for this employee.'
      : 'No application usage recorded in this period.';
  }

  /** The app's share of the period's tracked time, as a bar width. */
  share(minutes: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((minutes / total) * 100)) : 0;
  }

  fmt(minutes: number): string {
    return formatDurationCompact(minutes);
  }

  clock(iso: string): string {
    return formatClock(iso);
  }
}
