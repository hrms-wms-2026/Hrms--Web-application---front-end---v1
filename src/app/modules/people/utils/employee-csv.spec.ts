import { EMPLOYEE_COLUMNS } from '../models/employee-columns';
import { EmployeeListItemResponse } from '../models/employee.model';
import { toEmployeeCsv } from './employee-csv';

const row = (overrides: Partial<EmployeeListItemResponse> = {}): EmployeeListItemResponse => ({
  id: 'e1', employeeNumber: 'DAPI-0015', fullName: 'Saif Ahamed', email: 'saif@example.com',
  departmentId: null, departmentName: 'Watercraft Engineering', positionId: null, positionName: 'Watercraft Engineer',
  legalEntityId: 'le1', legalEntityName: 'Dapi', employmentTypeLabel: 'Full-time', status: 'active',
  reportingManagerId: null, reportingManagerName: 'Abitha Devendran', ...overrides
});

describe('toEmployeeCsv', () => {
  const cols = EMPLOYEE_COLUMNS.filter((c) => ['employee', 'position', 'department'].includes(c.key));

  it('writes a header and one line per row using the column labels and values', () => {
    expect(toEmployeeCsv([row()], cols)).toBe('Employee,Position,Department\r\nSaif Ahamed,Watercraft Engineer,Watercraft Engineering');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(toEmployeeCsv([row({ fullName: 'Doe, "J"\nX' })], cols.slice(0, 1))).toBe('Employee\r\n"Doe, ""J""\nX"');
  });

  it('neutralises spreadsheet formula prefixes', () => {
    expect(toEmployeeCsv([row({ fullName: '=HYPERLINK("x")' })], cols.slice(0, 1))).toBe('Employee\r\n"\'=HYPERLINK(""x"")"');
  });
});
