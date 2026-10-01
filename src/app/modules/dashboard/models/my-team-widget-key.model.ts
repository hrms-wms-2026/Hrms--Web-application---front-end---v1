export type MyTeamWidgetKey = 'priorityActions' | 'teamStatus' | 'approvalsExceptions' | 'teamProgress';

export const ALL_MY_TEAM_WIDGET_KEYS: readonly MyTeamWidgetKey[] = [
  'priorityActions',
  'teamStatus',
  'approvalsExceptions',
  'teamProgress'
];

export const MY_TEAM_WIDGET_LABEL: Record<MyTeamWidgetKey, string> = {
  priorityActions: 'Priority Actions',
  teamStatus: 'Team Status',
  approvalsExceptions: 'Approvals & Exceptions',
  teamProgress: 'Team Progress'
};
