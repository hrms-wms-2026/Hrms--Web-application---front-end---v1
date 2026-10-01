import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { actionCenterRailVisible, allowedWidgetKeys, resolveVisibleWidgets } from './my-team-widget-visibility.util';

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

  it('allows Action Center from canReviewPeopleApprovals alone', () => {
    expect(allowedWidgetKeys(capabilities({ canReviewPeopleApprovals: true }))).toEqual(['actionCenter']);
  });

  it('allows Action Center from canReviewExceptions alone', () => {
    expect(allowedWidgetKeys(capabilities({ canReviewExceptions: true }))).toEqual(['actionCenter']);
  });

  it('allows Action Center from hasWorkApprovals alone', () => {
    expect(allowedWidgetKeys(capabilities({ hasWorkApprovals: true }))).toEqual(['actionCenter']);
  });

  it('allows Action Center plus Team Progress for a module owner with no approval permissions (AC-2)', () => {
    expect(allowedWidgetKeys(capabilities({ leadsWork: true }))).toEqual(['actionCenter', 'teamProgress']);
  });

  it('allows everything, in the canonical order, when every flag is true', () => {
    expect(allowedWidgetKeys(capabilities({
      canViewPeopleStatus: true, canReviewPeopleApprovals: true, hasWorkApprovals: true, leadsWork: true
    }))).toEqual(['teamStatus', 'actionCenter', 'teamProgress']);
  });
});

describe('actionCenterRailVisible', () => {
  it('is false when capabilities is null', () => {
    expect(actionCenterRailVisible(null)).toBe(false);
  });

  it('is false for a leadsWork-only viewer (no approval/exception capability at all)', () => {
    expect(actionCenterRailVisible(capabilities({ leadsWork: true }))).toBe(false);
  });

  it('is true when canReviewPeopleApprovals is set, even without leadsWork', () => {
    expect(actionCenterRailVisible(capabilities({ canReviewPeopleApprovals: true }))).toBe(true);
  });

  it('is true when canReviewExceptions is set', () => {
    expect(actionCenterRailVisible(capabilities({ canReviewExceptions: true }))).toBe(true);
  });

  it('is true when hasWorkApprovals is set', () => {
    expect(actionCenterRailVisible(capabilities({ hasWorkApprovals: true }))).toBe(true);
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
    expect(resolveVisibleWidgets(caps, ['teamProgress', 'actionCenter'])).toEqual(['teamProgress', 'actionCenter']);
  });

  it('never surfaces a widget the capabilities forbid, even if it is in the stored preference', () => {
    const caps = capabilities({ canViewPeopleStatus: true });
    expect(resolveVisibleWidgets(caps, ['teamStatus', 'teamProgress', 'actionCenter'])).toEqual(['teamStatus']);
  });
});
