import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAppUsageResponse } from '../../models/employee-work-activity.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { appDisplayName, formatClock, formatDurationCompact } from '../../utils/employee-work-activity.utils';

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
        <span widget-actions class="whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
          Total <span class="font-semibold text-[var(--color-text-primary)]">{{ fmt(d.totalMinutes) }}</span>
        </span>
      }
      @if (loader.data(); as d) {
        <ul class="space-y-3">
          @for (app of d.apps; track app.appName) {
            <li data-testid="app-row" class="min-w-0">
              <div class="flex items-baseline justify-between gap-3">
                <span class="truncate text-sm font-semibold text-[var(--color-text-primary)]" [title]="appName(app.appName)">{{ appName(app.appName) }}</span>
                <span class="shrink-0 text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{{ fmt(app.activeMinutes) }}</span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]" aria-hidden="true">
                <div class="h-full rounded-full bg-[var(--color-accent)]" [style.width.%]="share(app.activeMinutes, d.totalMinutes)"></div>
              </div>
              <p class="mt-1 truncate text-[11px] text-[var(--color-text-secondary)]">
                {{ app.sessions }} {{ app.sessions === 1 ? 'session' : 'sessions' }} · Last used {{ clock(app.lastUsedAt) }}
              </p>
            </li>
          }
        </ul>
        @if ((d.meetingCompliance?.length ?? 0) > 0) {
          <div class="mt-5 border-t border-[var(--color-border)] pt-4">
            <h3 class="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Assigned meeting compliance</h3>
            <ul class="mt-3 space-y-3">
              @for (meeting of d.meetingCompliance ?? []; track meeting.eventId) {
                <li class="rounded-xl border border-[var(--color-border)] p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-[var(--color-text-primary)]" [title]="meeting.title">{{ meeting.title }}</p>
                      <p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                        Meeting app active {{ percentage(meeting.usagePercentage) }}% · minimum 50%
                      </p>
                    </div>
                    <span
                      class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold"
                      [class.bg-[var(--color-success-subtle)]]="meeting.isCompliant"
                      [class.text-[var(--color-success-text)]]="meeting.isCompliant"
                      [class.bg-[var(--color-warning-subtle)]]="!meeting.isCompliant"
                      [class.text-[var(--color-warning-text)]]="!meeting.isCompliant"
                    >{{ meeting.isCompliant ? 'Compliant' : 'Not detected' }}</span>
                  </div>
                </li>
              }
            </ul>
          </div>
        }
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

  appName(name: string): string {
    return appDisplayName(name);
  }

  fmt(minutes: number): string {
    return formatDurationCompact(minutes);
  }

  clock(iso: string): string {
    return formatClock(iso);
  }

  percentage(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
