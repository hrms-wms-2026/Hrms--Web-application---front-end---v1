import { Type } from '@angular/core';

export interface WidgetRegistryEntry {
  /**
   * Loads the card component. Each card is a dynamic import, so it becomes its own lazy chunk and is downloaded
   * only when the user's layout contains that widget (the backend already filters the layout by role and
   * permission). A static import here would put every card and every detail dialog in one chunk for everyone.
   */
  load: () => Promise<Type<unknown>>;
  inputs?: Record<string, unknown>;
  /** Card renders an in-place (non-CDK-overlay) dropdown that the frame must not clip. */
  overflowVisible?: boolean;
}

/**
 * Catalog widgets kept out of My Work: never rendered and not offered in the widget store. They stay in the
 * saved layout (the backend's layout PUT needs the full set), so Save and Reset are unaffected.
 */
export const HIDDEN_WIDGET_KEYS: ReadonlySet<string> = new Set([
  'my-tasks',
  'work-pattern',
  'notifications',
  'wellbeing',
]);

/**
 * Quick Actions is pinned: the dashboard shell draws it in the top-right corner above the grid, so it can't be
 * dragged, resized or removed. Its layout entry stays saved (as with the hidden widgets) but the grid skips it.
 */
export const PINNED_WIDGET_KEYS: ReadonlySet<string> = new Set([
  'quick-actions',
  'team-quick-actions',
]);

/** Widgets the grid never draws and the widget store never offers. */
export const OFF_GRID_WIDGET_KEYS: ReadonlySet<string> = new Set([
  ...HIDDEN_WIDGET_KEYS,
  ...PINNED_WIDGET_KEYS,
]);

/** widgetKey (as stored by the backend registry) to the card component that renders it. */
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  'today-at-a-glance': {
    load: () =>
      import('../feature/today-at-a-glance-card/today-at-a-glance-card.component').then(
        (m) => m.TodayAtAGlanceCardComponent,
      ),
  },
  'todays-schedule': {
    load: () =>
      import('../feature/todays-schedule-card/todays-schedule-card.component').then(
        (m) => m.TodaysScheduleCardComponent,
      ),
  },
  'today-total-time': {
    load: () =>
      import('../feature/weekly-progress-card/weekly-progress-card.component').then(
        (m) => m.WeeklyProgressCardComponent,
      ),
  },
  'active-projects': {
    load: () =>
      import('../feature/active-projects-card/active-projects-card.component').then(
        (m) => m.ActiveProjectsCardComponent,
      ),
  },
  'my-tasks': {
    load: () =>
      import('../feature/my-tasks-card/my-tasks-card.component').then(
        (m) => m.MyTasksCardComponent,
      ),
  },
  notifications: {
    load: () =>
      import('../feature/dashboard-notifications-card/dashboard-notifications-card.component').then(
        (m) => m.DashboardNotificationsCardComponent,
      ),
  },
  'quick-actions': {
    load: () =>
      import('../feature/quick-actions-card/quick-actions-card.component').then(
        (m) => m.QuickActionsCardComponent,
      ),
  },
  wellbeing: {
    load: () =>
      import('../feature/wellbeing-carousel-card/wellbeing-carousel-card.component').then(
        (m) => m.WellbeingCarouselCardComponent,
      ),
  },
  'work-pattern': {
    load: () =>
      import('../feature/work-pattern-card/work-pattern-card.component').then(
        (m) => m.WorkPatternCardComponent,
      ),
    overflowVisible: true,
  },
  'action-center': {
    load: () =>
      import('../feature/action-center-card/action-center-card.component').then(
        (m) => m.ActionCenterCardComponent,
      ),
  },
  'team-status': {
    load: () =>
      import('../feature/team-status-card/team-status-card.component').then(
        (m) => m.TeamStatusCardComponent,
      ),
  },
  'team-progress': {
    load: () =>
      import('../feature/team-progress-card/team-progress-card.component').then(
        (m) => m.TeamProgressCardComponent,
      ),
  },
  'team-attendance': {
    load: () =>
      import('../feature/team-attendance-card/team-attendance-card.component').then(
        (m) => m.TeamAttendanceCardComponent,
      ),
  },
  'team-schedule': {
    load: () =>
      import('../feature/team-schedule-card/team-schedule-card.component').then(
        (m) => m.TeamScheduleCardComponent,
      ),
  },
  'team-plan-today': {
    load: () =>
      import('../feature/team-plan-today-card/team-plan-today-card.component').then(
        (m) => m.TeamPlanTodayCardComponent,
      ),
  },
  'team-work-vs-task': {
    load: () =>
      import('../feature/team-work-task-card/team-work-task-card.component').then(
        (m) => m.TeamWorkTaskCardComponent,
      ),
  },
  'team-module-forecast': {
    load: () =>
      import('../feature/team-module-forecast-card/team-module-forecast-card.component').then(
        (m) => m.TeamModuleForecastCardComponent,
      ),
  },
  'team-employee-forecast': {
    load: () =>
      import('../feature/team-employee-forecast-card/team-employee-forecast-card.component').then(
        (m) => m.TeamEmployeeForecastCardComponent,
      ),
  },
  'team-quick-actions': {
    load: () =>
      import('../feature/quick-actions-card/quick-actions-card.component').then(
        (m) => m.QuickActionsCardComponent,
      ),
    inputs: { onTeamDashboard: true },
  },
};
