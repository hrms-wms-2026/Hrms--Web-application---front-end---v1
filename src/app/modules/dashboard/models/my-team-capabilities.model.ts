export interface MyTeamCapabilitiesResponse {
  isAvailable: boolean;
  canViewPeopleStatus: boolean;
  canReviewPeopleApprovals: boolean;
  canReviewExceptions: boolean;
  hasWorkApprovals: boolean;
  leadsWork: boolean;
  canViewLiveActivity: boolean;
  legalEntityId: string | null;
}
