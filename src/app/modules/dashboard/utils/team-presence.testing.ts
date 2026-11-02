import { TeamTodayMember, TeamTodayResponse } from '../models/my-team-today.model';

/** A Team Status member for specs; every new Working / Break / Leave field defaults to "no data". */
export function presenceMember(
  status: string,
  overrides: Partial<TeamTodayMember> = {},
): TeamTodayMember {
  return {
    employeeId: `${status}-${overrides.displayName ?? 'x'}`,
    displayName: status,
    avatarFileId: null,
    positionTitle: null,
    status,
    statusLabel: status,
    isLate: false,
    clockInAt: null,
    clockOutAt: null,
    attentionType: null,
    attentionLabel: null,
    attentionSeverity: null,
    leave: null,
    stateSince: null,
    breakRemainingMinutes: null,
    shiftEndsAt: null,
    attendanceMinutes: 0,
    expectedMinutes: null,
    breaks: [],
    leaveMinutes: 0,
    ...overrides,
  };
}

/** A team-today response whose summary is counted from the members. */
export function presenceResponse(members: TeamTodayMember[]): TeamTodayResponse {
  const count = (status: string) => members.filter((m) => m.status === status).length;
  return {
    workDate: '2026-10-29',
    timezone: 'Asia/Colombo',
    legalEntityId: 'le-1',
    summary: {
      total: members.length,
      working: count('working'),
      onBreak: count('on_break'),
      clockedOut: count('clocked_out'),
      late: members.filter((m) => m.isLate).length,
      absent: count('absent'),
      notStarted: count('not_started'),
      onLeave: count('on_leave'),
      notScheduled: count('not_scheduled'),
      needsAttention: members.filter((m) => m.attentionSeverity !== null).length,
    },
    members,
    totalMembers: members.length,
    asOf: '2026-10-29T10:00:00Z',
  };
}
