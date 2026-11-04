import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { rosterFromBalances } from './team-availability.component';

function row(employeeId: string, employeeName: string, leaveTypeId: string): LeaveBalanceResponse {
  return { employeeId, employeeNumber: employeeId, employeeName, departmentId: 'd1', departmentName: 'Engineering', legalEntityId: null, legalEntityName: null, leaveTypeId, leaveTypeName: leaveTypeId, leaveTypeCode: leaveTypeId, year: 2026, entitledHours: 0, annualHours: 0, carriedForwardHours: 0, usedHours: 0, pendingHours: 0, remainingHours: 0, isNegative: false, carryForwardExpiresOn: null };
}

describe('rosterFromBalances', () => {
  it('lists each person once, by name', () => {
    const roster = rosterFromBalances([row('e2', 'Suthan', 'al'), row('e1', 'Abitha', 'al'), row('e2', 'Suthan', 'sl')]);
    expect(roster.map((person) => person.name)).toEqual(['Abitha', 'Suthan']);
    expect(roster[0]).toEqual({ employeeId: 'e1', name: 'Abitha', departmentId: 'd1', departmentName: 'Engineering' });
  });
});
