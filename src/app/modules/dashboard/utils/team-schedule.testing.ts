import {
  TeamScheduleMember,
  TeamScheduleResponse,
  TeamScheduleWeekResponse,
  TeamWeekDay,
} from '../models/team-schedule.model';

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
    expectedMinutes: 480,
    breaks: [],
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

/** A team week: seven days from weekStart (empty unless dayOverrides fill them); totals are counted from the days. */
export function weekResponse(
  overrides: Partial<TeamScheduleWeekResponse> = {},
  dayOverrides: Partial<TeamWeekDay>[] = [],
): TeamScheduleWeekResponse {
  const weekStart = overrides.weekStart ?? '2026-10-26';
  const [y, m, d] = weekStart.split('-').map(Number);
  const days: TeamWeekDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
    plannedTaskMinutes: 0,
    plannedMeetingMinutes: 0,
    clockedMinutes: 0,
    scheduledMinutes: 0,
    outsideSlotMinutes: 0,
    noPlanMinutes: 0,
    ...dayOverrides[i],
  }));
  const sum = (pick: (day: TeamWeekDay) => number) =>
    days.reduce((total, day) => total + pick(day), 0);
  return {
    weekStart,
    weekEnd: days[6].date,
    plannerEnabled: true,
    asOf: '2026-10-28T06:30:00Z',
    days,
    totals: {
      plannedMinutes: sum((x) => x.plannedTaskMinutes + x.plannedMeetingMinutes),
      clockedMinutes: sum((x) => x.clockedMinutes),
      scheduledMinutes: sum((x) => x.scheduledMinutes),
      unscheduledMinutes: sum((x) => x.outsideSlotMinutes + x.noPlanMinutes),
      coveragePercent: null,
    },
    previous: {
      plannedMinutes: 0,
      clockedMinutes: 0,
      scheduledMinutes: 0,
      unscheduledMinutes: 0,
      coveragePercent: null,
    },
    members: [],
    ...overrides,
  };
}
