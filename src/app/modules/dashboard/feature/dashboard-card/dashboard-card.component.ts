import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DashboardCardKey } from '../../utils/dashboard-layout.util';
import { ActionCenterCardComponent } from '../action-center-card/action-center-card.component';
import { DashboardNotificationsCardComponent } from '../dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { TeamProgressCardComponent } from '../team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../team-status-card/team-status-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';
import { TodaysScheduleCardComponent } from '../todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../work-pattern-card/work-pattern-card.component';

/** Renders one dashboard card by its layout key. Only cards in the layout are created, so an
 * unticked card never loads its data. */
@Component({
  selector: 'app-dashboard-card',
  standalone: true,
  imports: [
    TodayAtAGlanceCardComponent,
    TodaysScheduleCardComponent,
    MyTasksCardComponent,
    DashboardNotificationsCardComponent,
    QuickActionsCardComponent,
    WellbeingCarouselCardComponent,
    WorkPatternCardComponent,
    TeamStatusCardComponent,
    ActionCenterCardComponent,
    TeamProgressCardComponent
  ],
  template: `
    @switch (key()) {
      @case ('todayAtAGlance') { <app-today-at-a-glance-card /> }
      @case ('todaysSchedule') { <app-todays-schedule-card /> }
      @case ('myTasks') { <app-my-tasks-card /> }
      @case ('notifications') { <app-dashboard-notifications-card /> }
      @case ('quickActions') { <app-quick-actions-card /> }
      @case ('wellbeing') { <app-wellbeing-carousel-card /> }
      @case ('workPattern') { <app-work-pattern-card /> }
      @case ('teamStatus') { <app-team-status-card id="my-team-widget-teamStatus" class="block scroll-mt-4" /> }
      @case ('actionCenter') { <app-action-center-card id="my-team-widget-actionCenter" class="block scroll-mt-4" /> }
      @case ('teamProgress') { <app-team-progress-card id="my-team-widget-teamProgress" class="block scroll-mt-4" /> }
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardCardComponent {
  readonly key = input.required<DashboardCardKey>();
}
