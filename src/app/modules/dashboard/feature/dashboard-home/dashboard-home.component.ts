import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardNotificationsCardComponent } from '../dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { MyTeamSectionComponent } from '../my-team-section/my-team-section.component';
import { MyTeamSlotComponent } from '../my-team-slot/my-team-slot.component';
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
 * - Col 1: Today at a Glance on top, Today's Schedule below it, then the 1st My Team widget;
 * - Col 2: My Tasks on top, Notifications below it, then the 2nd My Team widget;
 * - Col 3: Quick Actions on top, Wellbeing below it, then the 3rd My Team widget.
 * The My Team widgets (Team Status, Action Center, Team Progress by default, in the viewer's saved
 * order) fill the space under each column; each slot renders nothing for a viewer without My Team.
 * Secondary row: Work Pattern (This Week) full-width.
 * My Team row: the My Team heading, Customize picker and KPI strip - capability-gated (My Team
 * spec §5), rendering nothing at all when the viewer has none of its capability flags (AC-1).
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
    DashboardNotificationsCardComponent,
    MyTeamSectionComponent,
    MyTeamSlotComponent
  ],
  template: `
    <div class="dashboard-home flex flex-col gap-3">
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start" data-testid="dashboard-primary-row">
        <div class="flex flex-col gap-3">
          <app-today-at-a-glance-card />
          <app-todays-schedule-card />
          <app-my-team-slot [slot]="0" />
        </div>
        <div class="flex flex-col gap-3">
          <app-my-tasks-card />
          <app-dashboard-notifications-card />
          <app-my-team-slot [slot]="1" />
        </div>
        <div class="flex flex-col gap-3">
          <app-quick-actions-card />
          <app-wellbeing-carousel-card />
          <app-my-team-slot [slot]="2" />
        </div>
      </div>

      <div data-testid="dashboard-secondary-row">
        <app-work-pattern-card />
      </div>

      <div data-testid="dashboard-my-team-row">
        <app-my-team-section />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
