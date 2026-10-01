import { TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { buildActionCenterCategories } from './action-center-categories.util';

function response(overrides: Partial<TeamActionItemsResponse> = {}): TeamActionItemsResponse {
  return { legalEntityId: 'le-1', sources: [], ...overrides };
}

describe('action-center-categories.util', () => {
  it('returns an empty array when data is null', () => {
    expect(buildActionCenterCategories(null)).toEqual([]);
  });

  it('maps a known sourceKey to its label', () => {
    const result = buildActionCenterCategories(response({
      sources: [{
        sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 3,
        inProgressCount: null, oldestPendingAt: null, topItems: []
      }]
    }));
    expect(result).toEqual([{
      sourceKey: 'leave.approval', label: 'Leave requests', domain: 'people', status: 'ok',
      pendingCount: 3, oldestWaitingLabel: null
    }]);
  });

  it('falls back to the raw sourceKey when the label is unknown', () => {
    const result = buildActionCenterCategories(response({
      sources: [{
        sourceKey: 'some.new_source', domain: 'work', status: 'ok', pendingCount: 0,
        inProgressCount: null, oldestPendingAt: null, topItems: []
      }]
    }));
    expect(result[0].label).toBe('some.new_source');
  });

  it('computes an oldest-waiting label from oldestPendingAt', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const result = buildActionCenterCategories(response({
      sources: [{
        sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 1,
        inProgressCount: null, oldestPendingAt: twoHoursAgo, topItems: []
      }]
    }));
    expect(result[0].oldestWaitingLabel).toBe('oldest waiting 2h');
  });

  it('preserves an unavailable status and its placeholder zero count', () => {
    const result = buildActionCenterCategories(response({
      sources: [{
        sourceKey: 'monitoring.exception', domain: 'people', status: 'unavailable', pendingCount: 0,
        inProgressCount: null, oldestPendingAt: null, topItems: []
      }]
    }));
    expect(result[0]).toMatchObject({ status: 'unavailable', pendingCount: 0 });
  });

  it('preserves source order and maps every source', () => {
    const result = buildActionCenterCategories(response({
      sources: [
        { sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 1, inProgressCount: null, oldestPendingAt: null, topItems: [] },
        { sourceKey: 'work.objective_change', domain: 'work', status: 'ok', pendingCount: 4, inProgressCount: null, oldestPendingAt: null, topItems: [] }
      ]
    }));
    expect(result.map((c) => c.sourceKey)).toEqual(['leave.approval', 'work.objective_change']);
  });
});
