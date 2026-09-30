import { calculateTenure, employeeInitials, primaryLocation, shiftPeriodMonth, toPeriodMonth } from './employee-detail.utils';

describe('employee-detail utils', () => {
  it('builds initials and falls back to EM', () => {
    expect(employeeInitials('ada', 'lovelace')).toBe('AL');
    expect(employeeInitials(' ', null)).toBe('EM');
  });

  it('formats tenure in years and months', () => {
    const now = new Date(2026, 8, 30);
    expect(calculateTenure('2024-02-01', now)).toBe('2 yrs 7 mos');
    expect(calculateTenure('2026-09-01', now)).toBe('New Joiner');
    expect(calculateTenure(null, now)).toBe('—');
    expect(calculateTenure('not-a-date', now)).toBe('—');
  });

  it('reads city and country from the primary address', () => {
    const addresses = [
      { id: 'a1', addressType: 'home', addressJson: '{"city":"Kandy"}', isPrimary: false },
      { id: 'a2', addressType: 'home', addressJson: '{"city":"Colombo","country":"Sri Lanka"}', isPrimary: true }
    ];
    expect(primaryLocation(addresses)).toBe('Colombo, Sri Lanka');
    expect(primaryLocation([])).toBe('Not specified');
  });

  it('formats and shifts period months across year boundaries', () => {
    expect(toPeriodMonth(new Date(2026, 0, 15))).toBe('2026-01');
    expect(shiftPeriodMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriodMonth('2025-12', 1)).toBe('2026-01');
  });
});
