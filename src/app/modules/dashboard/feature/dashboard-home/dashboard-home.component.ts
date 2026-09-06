import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardNotificationsCardComponent } from '../dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';
import { TodaysScheduleCardComponent } from '../todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../work-pattern-card/work-pattern-card.component';

/**
 * Employee dashboard content area for the authenticated dashboard route.
 * Attendance Trend and Task Progress moved to the My Insights page
 * (see quick-actions-card); Activity Timeline got its own full page too.
 *
 * Layout: Primary row, 3 balanced columns:
 * - Col 1: Today at a Glance on top, Today's Schedule below it;
 * - Col 2: My Tasks on top, Notifications below it;
 * - Col 3: Quick Actions on top, Wellbeing below it.
 * Secondary row: Work Pattern (This Week) full-width.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  host: { class: 'block' },
  imports: [
    TodayAtAGlanceCardComponent,
    QuickActionsCardComponent,
    MyTasksCardComponent,
    TodaysScheduleCardComponent,
    WorkPatternCardComponent,
    WellbeingCarouselCardComponent,
    DashboardNotificationsCardComponent
  ],
  template: `
    <div class="dashboard-home flex flex-col gap-3">
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start" data-testid="dashboard-primary-row">
        <div class="flex flex-col gap-3">
          <app-today-at-a-glance-card />
          <app-todays-schedule-card />
        </div>
        <div class="flex flex-col gap-3">
          <app-my-tasks-card />
          <app-dashboard-notifications-card />
        </div>
        <div class="flex flex-col gap-3">
          <app-quick-actions-card />
          <app-wellbeing-carousel-card />
        </div>
      </div>

      <div data-testid="dashboard-secondary-row">
        <app-work-pattern-card />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
