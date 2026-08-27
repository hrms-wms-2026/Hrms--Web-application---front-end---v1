import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AttendanceTrendCardComponent } from '../attendance-trend-card/attendance-trend-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';

/**
 * Employee dashboard content area for the authenticated dashboard route.
 * Phase 1: cards backed by already-existing attendance data only. See
 * docs/superpowers/specs (2nd brain vault) for the full widget set and
 * later phases (My Tasks, Task Progress, Work Pattern, Today's Schedule).
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [TodayAtAGlanceCardComponent, AttendanceTrendCardComponent],
  template: `
    <div class="dashboard-home grid grid-cols-1 gap-4 lg:grid-cols-2">
      <app-today-at-a-glance-card />
      <app-attendance-trend-card />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
