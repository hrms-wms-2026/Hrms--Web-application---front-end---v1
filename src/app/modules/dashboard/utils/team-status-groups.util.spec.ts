import { describe, expect, it } from 'vitest';
import { TeamTodayMember } from '../models/my-team-today.model';
import { partitionTeamMembers } from './team-status-groups.util';

function member(id: string, status: string, overrides: Partial<TeamTodayMember> = {}): TeamTodayMember {
  return {
    employeeId: id, displayName: id, avatarFileId: null, positionTitle: null, status, statusLabel: status,
    isLate: false, clockInAt: null, clockOutAt: null, attentionType: null, attentionLabel: null,
    attentionSeverity: null, leave: null, ...overrides
  };
}

describe('partitionTeamMembers', () => {
  it('puts late, absent and not-started people in ordered exception groups and folds the rest', () => {
    const result = partitionTeamMembers(
      [
        member('a', 'absent'),
        member('w', 'working'),
        member('l', 'working', { isLate: true }),
        member('n', 'not_started'),
        member('v', 'on_leave'),
        member('b', 'on_break')
      ],
      null
    );
    expect(result.exceptionGroups.map((g) => g.key)).toEqual(['late', 'absent', 'not_started']);
    expect(result.exceptionGroups[0].members.map((m) => m.employeeId)).toEqual(['l']);
    expect(result.others.map((m) => m.employeeId)).toEqual(['w', 'v', 'b']);
  });

  it('treats any other backend attention flag as an exception', () => {
    const result = partitionTeamMembers([member('x', 'clocked_out', { attentionSeverity: 'warning' })], null);
    expect(result.exceptionGroups.map((g) => g.key)).toEqual(['attention']);
    expect(result.others).toEqual([]);
  });

  it('returns only matching members as one group when filtered', () => {
    const result = partitionTeamMembers(
      [member('w', 'working'), member('l', 'working', { isLate: true }), member('a', 'absent')],
      'late',
      'Late'
    );
    expect(result.exceptionGroups).toHaveLength(1);
    expect(result.exceptionGroups[0].label).toBe('Late');
    expect(result.exceptionGroups[0].members.map((m) => m.employeeId)).toEqual(['l']);
    expect(result.others).toEqual([]);
  });
});
