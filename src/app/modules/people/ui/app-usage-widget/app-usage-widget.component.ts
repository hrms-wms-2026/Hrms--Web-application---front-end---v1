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
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr>
              <th class="w-[35%] py-1 font-normal">Application</th>
              <th class="py-1 font-normal">Active time</th>
              <th class="py-1 font-normal">Sessions</th>
              <th class="py-1 font-normal">Last used</th>
            </tr>
          </thead>
          <tbody>
            @for (app of d.apps; track app.appName) {
              <tr data-testid="app-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2" [title]="app.appName">{{ app.appName }}</td>
                <td class="py-2">{{ fmt(app.activeMinutes) }}</td>
                <td class="py-2">{{ app.sessions }}</td>
                <td class="py-2">{{ clock(app.lastUsedAt) }}</td>
              </tr>
            }
          </tbody>
        </table>
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

  fmt(minutes: number): string {
    return formatDurationCompact(minutes);
  }

  clock(iso: string): string {
    return formatClock(iso);
  }
}
