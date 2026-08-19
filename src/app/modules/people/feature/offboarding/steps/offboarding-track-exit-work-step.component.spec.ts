import { groupTasksByCategory, overallProgressPercent } from './offboarding-track-exit-work-step.component';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';

function task(overrides: Partial<EmployeeChecklistTaskResponse>): EmployeeChecklistTaskResponse {
  return {
    id: 'task-1', taskTitle: 'x', ownerType: 'employee', assignedToId: 'u1', dueDate: '2026-12-01',
    isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null, status: 'pending', completedAt: null,
    ...overrides
  };
}

describe('groupTasksByCategory', () => {
  it('groups by category and counts resolved (completed or bypassed) vs total', () => {
    const tasks = [
      task({ category: 'asset_return', status: 'completed' }),
      task({ category: 'asset_return', status: 'pending' }),
      task({ category: 'access_removal', status: 'bypassed' })
    ];
    const result = groupTasksByCategory(tasks);
    expect(result.find((r) => r.category === 'Assets Returned')).toEqual({ category: 'Assets Returned', total: 2, resolved: 1 });
    expect(result.find((r) => r.category === 'Access Removed')).toEqual({ category: 'Access Removed', total: 1, resolved: 1 });
  });

  it('buckets null category as Other', () => {
    const result = groupTasksByCategory([task({ category: null })]);
    expect(result).toEqual([{ category: 'Other', total: 1, resolved: 0 }]);
  });
});

describe('overallProgressPercent', () => {
  it('returns 100 for an empty task list', () => {
    expect(overallProgressPercent([])).toBe(100);
  });

  it('computes the resolved percentage rounded to the nearest integer', () => {
    expect(overallProgressPercent([task({ status: 'completed' }), task({ status: 'pending' }), task({ status: 'pending' })])).toBe(33);
  });
});
