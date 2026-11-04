import { PlannerPersonDay, TeamPlannerMember } from '../../work/planner/models/team-planner.models';

/** Test builders for the team planner (2026-11-03): a Colombo working day 09:00–17:00 with nothing planned. */
export function personDay(date: string, over: Partial<PlannerPersonDay> = {}): PlannerPersonDay {
  return {
    date, workWindow: null, workStartAt: `${date}T03:30:00Z`, workEndAt: `${date}T11:30:00Z`, blocks: [], meetings: [], leaves: [],
    blockMinutes: 0, meetingMinutes: 0, workingMinutes: 480, capacityMinutes: 480, onLeave: false, ...over,
  };
}

export function member(id: string, name: string, days: PlannerPersonDay[], directReportCount = 0): TeamPlannerMember {
  return { employeeId: id, name, directReportCount, timezone: 'Asia/Colombo', days };
}
