import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { allowedWidgetKeys, resolveVisibleWidgets } from './my-team-widget-visibility.util';

function capabilities(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: false, canReviewPeopleApprovals: false,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: false,
    canViewLiveActivity: false, legalEntityId: 'le-1',
    ...overrides
  };
}

describe('allowedWidgetKeys', () => {
  it('returns nothing when capabilities is null', () => {
    expect(allowedWidgetKeys(null)).toEqual([]);
  });

  it('returns nothing when every flag is false (AC-1)', () => {
    expect(allowedWidgetKeys(capabilities())).toEqual([]);
  });

  it('allows Team Status only from canViewPeopleStatus', () => {
    expect(allowedWidgetKeys(capabilities({ canViewPeopleStatus: true }))).toEqual(['teamStatus']);
  });

  it('allows Priority Actions plus Approvals & Exceptions from canReviewPeopleApprovals alone', () => {
    expect(allowedWidgetKeys(capabilities({ canReviewPeopleApprovals: true })))
      .toEqual(['priorityActions', 'approvalsExceptions']);
  });

  it('allows Priority Actions plus Approvals & Exceptions from canReviewExceptions alone', () => {
    expect(allowedWidgetKeys(capabilities({ canReviewExceptions: true })))
      .toEqual(['priorityActions', 'approvalsExceptions']);
  });

  it('allows Priority Actions plus Approvals & Exceptions from hasWorkApprovals alone', () => {
    expect(allowedWidgetKeys(capabilities({ hasWorkApprovals: true })))
      .toEqual(['priorityActions', 'approvalsExceptions']);
  });

  it('allows Priority Actions plus Team Progress for a module owner with no permissions and no coverage (AC-2)', () => {
    expect(allowedWidgetKeys(capabilities({ leadsWork: true })))
      .toEqual(['priorityActions', 'teamProgress']);
  });

  it('allows everything, in the canonical order, when every flag is true', () => {
    expect(allowedWidgetKeys(capabilities({
      canViewPeopleStatus: true, canReviewPeopleApprovals: true, hasWorkApprovals: true, leadsWork: true
    }))).toEqual(['priorityActions', 'teamStatus', 'approvalsExceptions', 'teamProgress']);
  });
});

describe('resolveVisibleWidgets', () => {
  it('keeps the stored order for widgets still allowed', () => {
    const caps = capabilities({ canViewPeopleStatus: true, leadsWork: true });
    expect(resolveVisibleWidgets(caps, ['teamProgress', 'teamStatus'])).toEqual(['teamProgress', 'teamStatus']);
  });

  it('drops a stored widget that is no longer allowed', () => {
    const caps = capabilities({ canViewPeopleStatus: true });
    expect(resolveVisibleWidgets(caps, ['teamStatus', 'teamProgress'])).toEqual(['teamStatus']);
  });

  it('does not auto-show a widget that became newly allowed after the stored preference was saved', () => {
    // Not lost - allowedWidgetKeys (what the picker itself lists) still includes it, so the
    // viewer can turn it on; this function alone never re-adds something they haven't chosen.
    const caps = capabilities({ canViewPeopleStatus: true, leadsWork: true });
    expect(resolveVisibleWidgets(caps, ['teamStatus'])).toEqual(['teamStatus']);
  });

  it('respects an explicitly emptied preference (everything hidden) without reviving anything', () => {
    const caps = capabilities({ canViewPeopleStatus: true, leadsWork: true });
    expect(resolveVisibleWidgets(caps, [])).toEqual([]);
  });

  it('keeps a deliberately hidden widget hidden even though its capability is still allowed', () => {
    const caps = capabilities({ canViewPeopleStatus: true, leadsWork: true });
    // teamStatus is allowed but was left out of the saved preference on purpose.
    expect(resolveVisibleWidgets(caps, ['teamProgress', 'priorityActions'])).toEqual(['teamProgress', 'priorityActions']);
  });

  it('never surfaces a widget the capabilities forbid, even if it is in the stored preference', () => {
    const caps = capabilities({ canViewPeopleStatus: true });
    expect(resolveVisibleWidgets(caps, ['teamStatus', 'teamProgress', 'priorityActions'])).toEqual(['teamStatus']);
  });
});
