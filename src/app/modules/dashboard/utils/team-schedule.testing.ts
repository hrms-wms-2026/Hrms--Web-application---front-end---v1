import { TeamScheduleMember, TeamScheduleResponse } from '../models/team-schedule.model';

/** A local-time ISO instant on 2026-10-29 (built in the browser's zone, so timeline maths stays zone-independent). */
export function at(hour: number, minute = 0): string {
  return new Date(2026, 9, 29, hour, minute).toISOString();
}

export function scheduleMember(overrides: Partial<TeamScheduleMember> = {}): TeamScheduleMember {
  return {
    employeeId: `emp-${overrides.displayName ?? 'x'}`,
    displayName: 'Priya K',
    avatarFileId: null,
    timezone: 'Asia/Colombo',
    presenceStatus: null,
    plannedTaskMinutes: 0,
    plannedMeetingMinutes: 0,
    clockedMinutes: 0,
    scheduledMinutes: 0,
    outsideSlotMinutes: 0,
    noPlanMinutes: 0,
    itemCompletionPercent: null,
    timeCoveragePercent: null,
    score: null,
    notRankedReason: 'no_items_yet',
    rank: null,
    items: [],
    unscheduled: [],
    conflicts: [],
    ...overrides,
  };
}

export function scheduleResponse(
  members: TeamScheduleMember[],
  overrides: Partial<TeamScheduleResponse> = {},
): TeamScheduleResponse {
  return {
    date: '2026-10-29',
    plannerEnabled: true,
    asOf: '2026-10-29T06:00:00Z',
    summary: {
      people: members.length,
      tasksPlanned: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      tasksPending: 0,
      meetings: 0,
      peopleWithUnscheduledWork: members.filter((m) => m.outsideSlotMinutes + m.noPlanMinutes > 0)
        .length,
      unscheduledMinutes: members.reduce(
        (sum, m) => sum + m.outsideSlotMinutes + m.noPlanMinutes,
        0,
      ),
      conflicts: members.reduce((sum, m) => sum + m.conflicts.length, 0),
    },
    members,
    ...overrides,
  };
}
