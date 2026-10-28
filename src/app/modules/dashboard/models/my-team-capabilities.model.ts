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
}
