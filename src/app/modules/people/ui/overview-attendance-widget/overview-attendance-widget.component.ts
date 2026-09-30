import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDay } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { attendanceDayLabel } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-overview-attendance-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Attendance"
      [state]="loader.state()"
      errorMessage="Could not load attendance."
      emptyMessage="No attendance records for this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="attendance-stats">
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="stat-present">{{ d.present }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Present</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.late > 0" [class.text-[var(--color-text-primary)]]="d.late === 0" data-testid="stat-late">{{ d.late }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Late</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.missingClockOuts > 0" [class.text-[var(--color-text-primary)]]="d.missingClockOuts === 0" data-testid="stat-missing">{{ d.missingClockOuts }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Missing clock-out</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="stat-leave">{{ d.leaveDays }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Leave</dt>
          </div>
        </dl>

        <div class="mt-5 flex h-12 items-end gap-[3px]" role="img" [attr.aria-label]="stripLabel(d.days)" data-testid="attendance-strip">
          @for (day of d.days; track day.date) {
            <span
              data-testid="day-bar"
              class="day flex-1"
              [class]="'day--' + day.status"
              [attr.title]="day.date + ' · ' + label(day.status)"
            ></span>
          }
        </div>
        <p class="mt-2 text-xs text-[var(--color-text-secondary)]">
          {{ d.present }} of {{ d.workingDays }} working days attended
        </p>
      }
    </app-widget-card>
  `,
  styles: [`
    .day { min-width: 3px; border-radius: 2px; height: 100%; }
    .day--present { background: #16a34a; }
    .day--late { background: #f59e0b; }
    .day--missing_clock_out { background: #dc2626; }
    .day--leave { background: #3b82f6; }
    .day--absent { background: #f43f5e; }
    .day--off { background: var(--color-border); height: 30%; }
    .day--none { background: var(--color-surface-secondary); height: 30%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewAttendanceWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewAttendance(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.days.length === 0 }
  );

  label = attendanceDayLabel;

  stripLabel(days: readonly EmployeeAttendanceDay[]): string {
    const count = (status: EmployeeAttendanceDay['status']) => days.filter((d) => d.status === status).length;
    return `Daily attendance: ${count('present')} present, ${count('late')} late, ${count('missing_clock_out')} missing clock-out, ${count('leave')} on leave, ${count('absent')} absent`;
  }
}
