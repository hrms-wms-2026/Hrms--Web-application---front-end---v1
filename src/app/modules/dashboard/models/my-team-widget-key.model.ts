export type MyTeamWidgetKey = 'teamStatus' | 'actionCenter' | 'teamProgress';

export const ALL_MY_TEAM_WIDGET_KEYS: readonly MyTeamWidgetKey[] = [
  'teamStatus',
  'actionCenter',
  'teamProgress'
];

export const MY_TEAM_WIDGET_LABEL: Record<MyTeamWidgetKey, string> = {
  teamStatus: 'Team Status',
  actionCenter: 'Action Center',
  teamProgress: 'Team Progress'
};
