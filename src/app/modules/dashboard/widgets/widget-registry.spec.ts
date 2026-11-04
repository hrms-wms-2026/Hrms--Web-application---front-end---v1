import { describe, expect, it } from 'vitest';
import { ActionCenterCardComponent } from '../feature/action-center-card/action-center-card.component';
import { ActiveProjectsCardComponent } from '../feature/active-projects-card/active-projects-card.component';
import { DashboardNotificationsCardComponent } from '../feature/dashboard-notifications-card/dashboard-notifications-card.component';
import { MyTasksCardComponent } from '../feature/my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../feature/quick-actions-card/quick-actions-card.component';
import { TeamAttendanceCardComponent } from '../feature/team-attendance-card/team-attendance-card.component';
import { TeamPlanTodayCardComponent } from '../feature/team-plan-today-card/team-plan-today-card.component';
import { TeamProgressCardComponent } from '../feature/team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../feature/team-status-card/team-status-card.component';
import { TodayAtAGlanceCardComponent } from '../feature/today-at-a-glance-card/today-at-a-glance-card.component';
import { WeeklyProgressCardComponent } from '../feature/weekly-progress-card/weekly-progress-card.component';
import { TodaysScheduleCardComponent } from '../feature/todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../feature/wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../feature/work-pattern-card/work-pattern-card.component';
import { WIDGET_REGISTRY } from './widget-registry';

describe('WIDGET_REGISTRY', () => {
  it('maps_each_key_to_its_component', () => {
    const expected: Record<string, unknown> = {
      'today-at-a-glance': TodayAtAGlanceCardComponent,
      'todays-schedule': TodaysScheduleCardComponent,
      'today-total-time': WeeklyProgressCardComponent,
      'active-projects': ActiveProjectsCardComponent,
      'my-tasks': MyTasksCardComponent,
      notifications: DashboardNotificationsCardComponent,
      'quick-actions': QuickActionsCardComponent,
      wellbeing: WellbeingCarouselCardComponent,
      'work-pattern': WorkPatternCardComponent,
      'action-center': ActionCenterCardComponent,
      'team-status': TeamStatusCardComponent,
      'team-progress': TeamProgressCardComponent,
      'team-attendance': TeamAttendanceCardComponent,
      'team-plan-today': TeamPlanTodayCardComponent,
      'team-quick-actions': QuickActionsCardComponent
    };
    expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual(Object.keys(expected).sort());
    for (const [key, component] of Object.entries(expected)) {
      expect(WIDGET_REGISTRY[key].component, key).toBe(component);
    }
  });

  it('team_quick_actions_passes_onTeamDashboard', () => {
    expect(WIDGET_REGISTRY['team-quick-actions'].inputs).toEqual({ onTeamDashboard: true });
    expect(WIDGET_REGISTRY['quick-actions'].inputs).toBeUndefined();
  });

  it('only_work_pattern_is_overflow_visible', () => {
    const flagged = Object.keys(WIDGET_REGISTRY).filter((k) => WIDGET_REGISTRY[k].overflowVisible);
    expect(flagged).toEqual(['work-pattern']);
  });
});
