import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { ALL_MY_TEAM_WIDGET_KEYS, MyTeamWidgetKey } from '../models/my-team-widget-key.model';

/** Which widgets the viewer's capabilities allow at all (My Team spec §6, §14 "widget-level, not
 * page-level, visibility"). Priority Actions has no capability flag of its own - it is allowed
 * whenever at least one of the inputs it draws from is (spec §6 Widget Authorization Matrix).
 * Order always follows ALL_MY_TEAM_WIDGET_KEYS, the single canonical ordering. */
export function allowedWidgetKeys(capabilities: MyTeamCapabilitiesResponse | null): MyTeamWidgetKey[] {
  if (!capabilities) return [];
  const peopleOrWorkApprovals =
    capabilities.canReviewPeopleApprovals || capabilities.canReviewExceptions || capabilities.hasWorkApprovals;
  const allowed: Record<MyTeamWidgetKey, boolean> = {
    teamStatus: capabilities.canViewPeopleStatus,
    approvalsExceptions: peopleOrWorkApprovals,
    teamProgress: capabilities.leadsWork,
    priorityActions: peopleOrWorkApprovals || capabilities.leadsWork
  };
  return ALL_MY_TEAM_WIDGET_KEYS.filter((key) => allowed[key]);
}

/** The viewer's stored show/hide/reorder preference, filtered down to what their capabilities
 * currently allow - in the stored order, which is exactly the display order (My Team spec §5).
 * A widget the viewer deliberately hid stays hidden even if their capabilities are re-checked
 * later: this never re-adds anything on its own. A widget whose capability was granted after the
 * viewer last saved a preference simply isn't auto-shown - it is never lost, because the picker's
 * own available-item list is always built straight from allowedWidgetKeys (spec §5), independent
 * of what is currently visible, so the viewer can turn it on there at any time. */
export function resolveVisibleWidgets(
  capabilities: MyTeamCapabilitiesResponse | null,
  storedPreference: readonly MyTeamWidgetKey[]
): MyTeamWidgetKey[] {
  const allowed = allowedWidgetKeys(capabilities);
  return storedPreference.filter((key) => allowed.includes(key));
}
