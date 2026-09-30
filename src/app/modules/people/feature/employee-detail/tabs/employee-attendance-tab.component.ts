import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeePeriodStore } from '../../../state/employee-period.store';
import { OverviewAttendanceWidgetComponent } from '../../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewTimeOffWidgetComponent } from '../../../ui/overview-time-off-widget/overview-time-off-widget.component';

/**
 * Attendance tab: per-widget attendance, discipline and time-off cards. Each widget loads
 * independently; the period-aware ones read the tab-scoped EmployeePeriodStore, which mirrors
 * the shell's period filter. Time Off is year-based and ignores the month.
 */
@Component({
  selector: 'app-employee-attendance-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [OverviewAttendanceWidgetComponent, OverviewDisciplineWidgetComponent, OverviewTimeOffWidgetComponent],
  template: `
    @if (store.employeeId(); as employeeId) {
      <div class="grid gap-4 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <app-overview-attendance-widget [employeeId]="employeeId" />
        </div>
        <app-overview-time-off-widget [employeeId]="employeeId" />
      </div>

      <div class="mt-4">
        <app-overview-discipline-widget [employeeId]="employeeId" />
      </div>
    }
  `,
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeAttendanceTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
  private readonly period = inject(EmployeePeriodStore);

  constructor() {
    // Seed synchronously so the widgets' first load already uses the shell's month.
    this.period.setMonth(this.store.periodMonth());
    effect(() => {
      const month = this.store.periodMonth();
      untracked(() => this.period.setMonth(month));
    });
  }
}
