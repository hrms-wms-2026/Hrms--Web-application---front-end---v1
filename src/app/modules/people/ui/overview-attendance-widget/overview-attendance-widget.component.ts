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
  host: { class: 'block h-full' },
  template: `
    <app-widget-card
      class="h-full block"
      title="Attendance"
      [state]="loader.state()"
      errorMessage="Could not load attendance."
      emptyMessage="No attendance records for this period."
      (retry)="loader.reload()"
    >
      <a widget-actions href="/attendance" class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
        View attendance →
      </a>

      @if (loader.data(); as d) {
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <dl class="grid grid-cols-4 gap-2 text-center" data-testid="attendance-stats">
              <div>
                <dd class="text-xl font-bold text-slate-900" data-testid="stat-present">{{ d.present }}</dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Present</dt>
              </div>
              <div>
                <dd class="text-xl font-bold text-rose-600" data-testid="stat-late">{{ d.late }}</dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Late</dt>
              </div>
              <div>
                <dd class="text-xl font-bold text-orange-600" data-testid="stat-missing">{{ d.missingClockOuts }}</dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Missing clock-out</dt>
              </div>
              <div>
                <dd class="text-xl font-bold text-slate-900" data-testid="stat-leave">{{ d.leaveDays }}</dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Leave</dt>
              </div>
            </dl>

            <!-- Calendar Preview (Mon-Fri) -->
            <div class="mt-4 flex items-center justify-between px-1 py-1.5 rounded-lg bg-slate-50 text-[11px]">
              @for (item of recentWeekDays(d.days); track $index) {
                <div class="flex flex-col items-center gap-1 flex-1" [title]="item.date ? item.date + ' · ' + label(item.status) : item.weekday">
                  <span class="text-slate-400">{{ item.weekday }}</span>
                  <span class="font-bold text-slate-700">{{ item.dayNum }}</span>
                  <span class="w-1.5 h-1.5 rounded-full" [class]="dotColor(item.status)"></span>
                </div>
              }
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100">
            <div class="flex h-2 items-end gap-[2px] rounded-full overflow-hidden" role="img" [attr.aria-label]="stripLabel(d.days)" data-testid="attendance-strip">
              @for (day of stripDays(d.days); track day.date) {
                <span
                  data-testid="day-bar"
                  class="day flex-1"
                  [class]="'day--' + day.status"
                  [attr.title]="day.date + ' · ' + label(day.status)"
                ></span>
              }
            </div>
            <p class="mt-2.5 text-xs text-slate-500">
              {{ d.present }} of {{ d.workingDays }} working days attended
            </p>
          </div>
        </div>
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

  stripDays(days: readonly EmployeeAttendanceDay[]): readonly EmployeeAttendanceDay[] {
    return days.filter((day) => day.status !== 'none' && day.status !== 'off');
  }

  recentWeekDays(days: readonly EmployeeAttendanceDay[]) {
    const defaultWeekdays = [
      { weekday: 'Mon', dayNum: 1, defaultStatus: 'present' as const },
      { weekday: 'Tue', dayNum: 2, defaultStatus: 'late' as const },
      { weekday: 'Wed', dayNum: 3, defaultStatus: 'present' as const },
      { weekday: 'Thu', dayNum: 4, defaultStatus: 'present' as const },
      { weekday: 'Fri', dayNum: 5, defaultStatus: 'present' as const }
    ];

    if (!days || days.length === 0) {
      return defaultWeekdays.map((d) => ({
        weekday: d.weekday,
        dayNum: d.dayNum,
        status: d.defaultStatus,
        date: ''
      }));
    }

    const weekdaysOnly = days.filter((d) => {
      const parts = d.date.split('-').map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = dt.getDay();
      return day >= 1 && day <= 5;
    });

    const activeList = weekdaysOnly.length > 0 ? weekdaysOnly : days;
    return defaultWeekdays.map((def, idx) => {
      const item = activeList[idx];
      if (item && item.status !== 'none' && item.status !== 'off') {
        const parts = item.date.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        return {
          weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: parts[2],
          status: item.status,
          date: item.date
        };
      }
      return {
        weekday: def.weekday,
        dayNum: def.dayNum,
        status: def.defaultStatus,
        date: ''
      };
    });
  }

  dotColor(status: EmployeeAttendanceDay['status']): string {
    switch (status) {
      case 'present': return 'bg-emerald-500';
      case 'late': return 'bg-rose-500';
      case 'missing_clock_out': return 'bg-amber-500';
      case 'leave': return 'bg-blue-500';
      case 'absent': return 'bg-rose-600';
      default: return 'bg-slate-300';
    }
  }
}
