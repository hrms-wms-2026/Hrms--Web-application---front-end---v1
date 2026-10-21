import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';

/** Whether Action Center's category rail should render at all - distinct from the card's own
 * overall visibility. A leadsWork-only viewer (no approval/exception
 * capability) sees the card, but with no rail: the rail needs at least one of its own inputs to be
 * gated in, same formula as the pre-merge Approvals & Exceptions card's own visibility. */
export function actionCenterRailVisible(capabilities: MyTeamCapabilitiesResponse | null): boolean {
  if (!capabilities) return false;
  return capabilities.canReviewPeopleApprovals || capabilities.canReviewExceptions || capabilities.hasWorkApprovals;
}
