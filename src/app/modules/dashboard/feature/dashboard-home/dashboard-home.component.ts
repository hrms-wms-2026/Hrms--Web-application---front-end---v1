import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardGreetingComponent } from '../dashboard-greeting/dashboard-greeting.component';
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
 * Visual hierarchy (V2): Today at a Glance + My Tasks are primary (own row,
 * largest presence); Today's Schedule + Work Pattern are secondary (own row);
 * Quick Actions is the action area (full width); Wellbeing is supporting and
 * sits last, visually lightest. See docs/dashboard-widget-inventory.md for
 * the per-widget rationale this hierarchy is based on.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    DashboardGreetingComponent,
    TodayAtAGlanceCardComponent,
    QuickActionsCardComponent,
    MyTasksCardComponent,
    TodaysScheduleCardComponent,
    WorkPatternCardComponent,
    WellbeingCarouselCardComponent
  ],
  template: `
    <div class="dashboard-home flex flex-col gap-6">
      <app-dashboard-greeting />

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="dashboard-primary-row">
        <app-today-at-a-glance-card />
        <app-my-tasks-card />
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="dashboard-secondary-row">
        <app-todays-schedule-card />
        <app-work-pattern-card />
      </div>

      <app-quick-actions-card />

      <app-wellbeing-carousel-card />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
