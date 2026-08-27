import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AttendanceTrendCardComponent } from '../attendance-trend-card/attendance-trend-card.component';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';

/**
 * Employee dashboard content area for the authenticated dashboard route.
 * See docs/superpowers/specs (2nd brain vault) for the full widget set and
 * remaining later phases (Task Progress, Work Pattern, Today's Schedule).
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [TodayAtAGlanceCardComponent, AttendanceTrendCardComponent, MyTasksCardComponent],
  template: `
    <div class="dashboard-home grid grid-cols-1 gap-4 lg:grid-cols-2">
      <app-today-at-a-glance-card />
      <app-attendance-trend-card />
      <app-my-tasks-card />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
