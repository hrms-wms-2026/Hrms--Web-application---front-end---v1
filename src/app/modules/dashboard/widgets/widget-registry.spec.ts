import { describe, expect, it } from 'vitest';
import { WIDGET_REGISTRY } from './widget-registry';

describe('WIDGET_REGISTRY', () => {
  it('has_the_13_widget_keys', () => {
    expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual(
      [
        'action-center', 'active-projects', 'my-tasks', 'notifications', 'quick-actions', 'team-progress',
        'team-quick-actions', 'team-status', 'today-at-a-glance', 'today-total-time', 'todays-schedule',
        'wellbeing', 'work-pattern'
      ].sort()
    );
  });

  it('team_quick_actions_passes_onTeamDashboard', () => {
    expect(WIDGET_REGISTRY['team-quick-actions'].inputs).toEqual({ onTeamDashboard: true });
    expect(WIDGET_REGISTRY['quick-actions'].inputs).toBeUndefined();
  });
});
