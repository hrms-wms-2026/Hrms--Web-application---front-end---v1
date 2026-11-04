import { Type } from '@angular/core';
import { ActionCenterCardComponent } from '../feature/action-center-card/action-center-card.component';
import { ActiveProjectsCardComponent } from '../feature/active-projects-card/active-projects-card.component';
import { DashboardNotificationsCardComponent } from '../feature/dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../feature/my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../feature/quick-actions-card/quick-actions-card.component';
import { TeamAttendanceCardComponent } from '../feature/team-attendance-card/team-attendance-card.component';
import { TeamPlanTodayCardComponent } from '../feature/team-plan-today-card/team-plan-today-card.component';
import { TeamScheduleCardComponent } from '../feature/team-schedule-card/team-schedule-card.component';
import { TeamProgressCardComponent } from '../feature/team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../feature/team-status-card/team-status-card.component';
import { TodayAtAGlanceCardComponent } from '../feature/today-at-a-glance-card/today-at-a-glance-card.component';
import { WeeklyProgressCardComponent } from '../feature/weekly-progress-card/weekly-progress-card.component';
import { TodaysScheduleCardComponent } from '../feature/todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../feature/wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../feature/work-pattern-card/work-pattern-card.component';

export interface WidgetRegistryEntry {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  /** Card renders an in-place (non-CDK-overlay) dropdown that the frame must not clip. */
  overflowVisible?: boolean;
}

/**
 * Catalog widgets kept out of My Work: never rendered and not offered in the widget store. They stay in the
 * saved layout (the backend's layout PUT needs the full set), so Save and Reset are unaffected.
 */
export const HIDDEN_WIDGET_KEYS: ReadonlySet<string> = new Set(['my-tasks', 'work-pattern', 'notifications', 'wellbeing']);

/**
 * Quick Actions is pinned: the dashboard shell draws it in the top-right corner above the grid, so it can't be
 * dragged, resized or removed. Its layout entry stays saved (as with the hidden widgets) but the grid skips it.
 */
export const PINNED_WIDGET_KEYS: ReadonlySet<string> = new Set(['quick-actions', 'team-quick-actions']);

/** Widgets the grid never draws and the widget store never offers. */
export const OFF_GRID_WIDGET_KEYS: ReadonlySet<string> = new Set([...HIDDEN_WIDGET_KEYS, ...PINNED_WIDGET_KEYS]);

/** widgetKey (as stored by the backend registry) to the card component that renders it. */
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  'today-at-a-glance': { component: TodayAtAGlanceCardComponent },
  'todays-schedule': { component: TodaysScheduleCardComponent },
  'today-total-time': { component: WeeklyProgressCardComponent },
  'active-projects': { component: ActiveProjectsCardComponent },
  'my-tasks': { component: MyTasksCardComponent },
  notifications: { component: DashboardNotificationsCardComponent },
  'quick-actions': { component: QuickActionsCardComponent },
  wellbeing: { component: WellbeingCarouselCardComponent },
  'work-pattern': { component: WorkPatternCardComponent, overflowVisible: true },
  'action-center': { component: ActionCenterCardComponent },
  'team-status': { component: TeamStatusCardComponent },
  'team-progress': { component: TeamProgressCardComponent },
  'team-attendance': { component: TeamAttendanceCardComponent },
  'team-schedule': { component: TeamScheduleCardComponent },
  'team-plan-today': { component: TeamPlanTodayCardComponent },
  'team-quick-actions': { component: QuickActionsCardComponent, inputs: { onTeamDashboard: true } }
};
