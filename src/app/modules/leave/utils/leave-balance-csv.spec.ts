import { LeaveBalanceResponse } from '../models/leave-balance.model';
import { balancesToCsv } from './leave-balance-csv';

const row: LeaveBalanceResponse = {
  employeeId: 'emp-1',
  employeeNumber: 'EMP-001',
  employeeName: 'Anu, Raman',
  departmentId: 'dept-1',
  departmentName: 'Engineering',
  legalEntityId: 'le-1',
  legalEntityName: 'Acme',
  leaveTypeId: 'type-1',
  leaveTypeName: 'Annual Leave',
  leaveTypeCode: 'ANNUAL',
  year: 2026,
  entitledHours: 20,
  annualHours: 20,
  carriedForwardHours: 2,
  usedHours: 4,
  pendingHours: 1,
  remainingHours: 17,
  isNegative: false,
  carryForwardExpiresOn: '2026-12-31'
};

describe('balancesToCsv', () => {
  it('writes a header and one data row', () => {
    const csv = balancesToCsv([row]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Employee');
    expect(lines[0]).toContain('Remaining');
    expect(lines[1]).toContain('"Anu, Raman"');
    expect(lines[1]).toContain('ANNUAL');
    expect(lines[1]).toContain('17');
    expect(lines[1]).toContain('2026-12-31');
  });

  it('returns only the header when there are no rows', () => {
    expect(balancesToCsv([]).split('\n')).toHaveLength(1);
  });
});
