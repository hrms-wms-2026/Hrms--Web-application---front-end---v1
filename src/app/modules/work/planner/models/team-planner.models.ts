import { PlannerMeetingView, PlannerRangeBlockView, PlannerWorkWindow } from './planner.models';

/** Team planner (2026-11-03): leave by status only. "busy" is approved leave for a viewer who may not read leave. */
export interface PlannerLeaveView {
  startAt: string;
  endAt: string;
  status: 'approved' | 'pending' | 'busy';
}

/** One of a person's days, in their own zone. */
export interface PlannerPersonDay {
  date: string;
  workWindow: PlannerWorkWindow | null;
  /** The work window as instants; null on a non-working day. */
  workStartAt: string | null;
  workEndAt: string | null;
  blocks: PlannerRangeBlockView[];
  meetings: PlannerMeetingView[];
  leaves: PlannerLeaveView[];
  blockMinutes: number;
  meetingMinutes: number;
  workingMinutes: number;
  /** Working minutes less approved leave inside the work window. */
  capacityMinutes: number;
  onLeave: boolean;
}

/** GET /planner/employees/{id}/range: one person's days, read-only. */
export interface PlannerPersonRangeResponse {
  employeeId: string;
  name: string;
  timezone: string;
  today: string;
  days: PlannerPersonDay[];
}

export interface TeamPlannerMember {
  employeeId: string;
  name: string;
  directReportCount: number;
  timezone: string;
  days: PlannerPersonDay[];
}

/** GET /planner/team and /planner/team/range: a manager's direct reports, ordered by name. */
export interface TeamPlannerResponse {
  managerEmployeeId: string;
  managerName: string;
  from: string;
  to: string;
  members: TeamPlannerMember[];
}
