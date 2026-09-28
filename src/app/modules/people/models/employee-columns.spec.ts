import { DEFAULT_EMPLOYEE_COLUMNS, EMPLOYEE_COLUMNS, loadEmployeeColumns, saveEmployeeColumns } from './employee-columns';

describe('employee columns', () => {
  beforeEach(() => localStorage.clear());

  it('defaults when nothing is stored', () => {
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
  });

  it('round-trips a saved selection in canonical column order and always keeps the locked employee column', () => {
    saveEmployeeColumns(['email', 'position']);
    expect(loadEmployeeColumns()).toEqual(['employee', 'position', 'email']);
  });

  it('ignores unknown keys and falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('employee_list_columns', JSON.stringify(['bogus', 'status']));
    expect(loadEmployeeColumns()).toEqual(['employee', 'status']);
    localStorage.setItem('employee_list_columns', '{not json');
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
  });

  it('survives a throwing localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
    spy.mockRestore();
  });

  it('employee is the only locked column and every sortable column maps to a backend sort key', () => {
    expect(EMPLOYEE_COLUMNS.filter((c) => c.locked).map((c) => c.key)).toEqual(['employee']);
    expect(EMPLOYEE_COLUMNS.filter((c) => c.sortKey).map((c) => c.sortKey))
      .toEqual(['name', 'position', 'department', 'employmentType', 'manager']);
  });
});
