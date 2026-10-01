import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-overview-discipline-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Attendance Discipline"
      [state]="loader.state()"
      errorMessage="Could not load attendance discipline."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-1 gap-y-3 text-sm">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Late clock-ins</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.lateClockIns > 0" data-testid="discipline-late">{{ d.lateClockIns }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Early clock-outs</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.earlyClockOuts > 0" data-testid="discipline-early">{{ d.earlyClockOuts }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Missing clock-outs</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.missingClockOuts > 0" data-testid="discipline-missing">{{ d.missingClockOuts }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Over break</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.overBreakDays > 0" data-testid="discipline-over-break">{{ overBreakText(d) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 pb-2">
            <dt class="text-[var(--color-text-secondary)]">Outside work location</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="(d.locationViolations ?? 0) > 0" data-testid="discipline-location">{{ locationText(d) }}</dd>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDisciplineWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() =>
    this.api.getOverviewAttendanceDiscipline(
      this.employeeId(), this.period.from(), this.period.to(), false
    )
  );

  overBreakText(d: EmployeeAttendanceDisciplineResponse): string {
    if (d.overBreakDays === 0) return 'None';
    return `${d.overBreakDays} ${d.overBreakDays === 1 ? 'day' : 'days'} · ${d.overBreakMinutes} min`;
  }

  locationText(d: EmployeeAttendanceDisciplineResponse): string {
    if (!d.locationTrackingEnabled) return 'Not monitored';
    const count = d.locationViolations ?? 0;
    return `${count} ${count === 1 ? 'alert' : 'alerts'}`;
  }
}
