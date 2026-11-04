export interface MyTeamCapabilitiesResponse {
  isAvailable: boolean;
  canViewPeopleStatus: boolean;
  canReviewPeopleApprovals: boolean;
  canReviewExceptions: boolean;
  hasWorkApprovals: boolean;
  leadsWork: boolean;
  canViewLiveActivity: boolean;
  /** At least one direct report in the reporting line (Today's team schedule). */
  hasReports: boolean;
  legalEntityId: string | null;
  /** Team planner (2026-11-03): the planner is on and the viewer has a direct report. Absent from an older API. */
  canViewTeamPlan?: boolean;
}
