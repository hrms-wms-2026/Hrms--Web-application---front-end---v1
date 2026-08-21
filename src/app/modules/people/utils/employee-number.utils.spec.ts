import {
  EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE,
  EMPLOYEE_NUMBER_MAX_LENGTH,
  isValidEmployeeNumberFormat,
  normalizeEmployeeNumber
} from './employee-number.utils';

describe('employee-number.utils', () => {
  it('accepts seeded-style numbers', () => {
    expect(isValidEmployeeNumberFormat('DAPI-0001')).toBe(true);
    expect(isValidEmployeeNumberFormat('ACME_7')).toBe(true);
  });

  it('rejects spaces and invalid characters', () => {
    expect(isValidEmployeeNumberFormat('DAPI 0001')).toBe(false);
    expect(isValidEmployeeNumberFormat('DAPI/1')).toBe(false);
    expect(isValidEmployeeNumberFormat('')).toBe(false);
  });

  it('normalizes by trimming only', () => {
    expect(normalizeEmployeeNumber('  ACME-0001  ')).toBe('ACME-0001');
    expect(normalizeEmployeeNumber(null)).toBe('');
  });

  it('enforces max length', () => {
    expect(EMPLOYEE_NUMBER_MAX_LENGTH).toBe(20);
    expect(isValidEmployeeNumberFormat('A'.repeat(21))).toBe(false);
    expect(EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE).toContain('letters, numbers');
  });
});
