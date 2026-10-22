import { Type } from '@angular/core';
import { ActionCenterCardComponent } from '../feature/action-center-card/action-center-card.component';
import { ActiveProjectsCardComponent } from '../feature/active-projects-card/active-projects-card.component';
import { DashboardNotificationsCardComponent } from '../feature/dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../feature/my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../feature/quick-actions-card/quick-actions-card.component';
import { TeamProgressCardComponent } from '../feature/team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../feature/team-status-card/team-status-card.component';
import { TodayAtAGlanceCardComponent } from '../feature/today-at-a-glance-card/today-at-a-glance-card.component';
import { TodayTotalTimeCardComponent } from '../feature/today-total-time-card/today-total-time-card.component';
import { TodaysScheduleCardComponent } from '../feature/todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../feature/wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../feature/work-pattern-card/work-pattern-card.component';

export interface WidgetRegistryEntry {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  /** Card renders an in-place (non-CDK-overlay) dropdown that the frame must not clip. */
  overflowVisible?: boolean;
}

/** widgetKey (as stored by the backend registry) to the card component that renders it. */
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  'today-at-a-glance': { component: TodayAtAGlanceCardComponent },
  'todays-schedule': { component: TodaysScheduleCardComponent },
  'today-total-time': { component: TodayTotalTimeCardComponent },
  'active-projects': { component: ActiveProjectsCardComponent },
  'my-tasks': { component: MyTasksCardComponent },
  notifications: { component: DashboardNotificationsCardComponent },
  'quick-actions': { component: QuickActionsCardComponent },
  wellbeing: { component: WellbeingCarouselCardComponent },
  'work-pattern': { component: WorkPatternCardComponent, overflowVisible: true },
  'action-center': { component: ActionCenterCardComponent },
  'team-status': { component: TeamStatusCardComponent },
  'team-progress': { component: TeamProgressCardComponent },
  'team-quick-actions': { component: QuickActionsCardComponent, inputs: { onTeamDashboard: true } }
};
