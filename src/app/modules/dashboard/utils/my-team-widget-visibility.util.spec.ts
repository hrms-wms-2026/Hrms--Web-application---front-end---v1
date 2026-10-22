import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { actionCenterRailVisible } from './my-team-widget-visibility.util';

function capabilities(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: false, canReviewPeopleApprovals: false,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: false,
    canViewLiveActivity: false, legalEntityId: 'le-1',
    ...overrides
  };
}

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
