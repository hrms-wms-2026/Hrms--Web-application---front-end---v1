import {
  calculateTenure,
  employeeInitials,
  nextWorkAnniversary,
  primaryLocation,
  probationStatus,
  profileCompletion,
  shiftPeriodMonth,
  toPeriodMonth
} from './employee-detail.utils';
import { detailFixture } from '../feature/employee-detail/tabs/employee-detail-tab.testing';

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

  it('scores profile completion over the sections the response carries', () => {
    expect(profileCompletion(detailFixture)).toEqual({
      percent: 0,
      items: [
        { label: 'Basic Information', complete: false },
        { label: 'Contact Information', complete: false },
        { label: 'Address Information', complete: false },
        { label: 'Emergency Contact', complete: false }
      ]
    });

    const complete = profileCompletion({
      ...detailFixture,
      personalInformation: {
        ...detailFixture.personalInformation,
        phone: '+94 77 000 0000',
        dateOfBirth: '1990-05-01',
        gender: 'female',
        addresses: [{ id: 'a1', addressType: 'home', addressJson: '{}', isPrimary: true }]
      }
    });
    expect(complete.percent).toBe(75);
  });

  it('finds the next work anniversary after today', () => {
    const now = new Date(2026, 8, 30);
    expect(nextWorkAnniversary('2024-02-01', now)).toEqual({ date: new Date(2027, 1, 1), daysUntil: 124, years: 3 });
    expect(nextWorkAnniversary('2024-10-01', now)).toEqual({ date: new Date(2026, 9, 1), daysUntil: 1, years: 2 });
    expect(nextWorkAnniversary('2026-09-15', now)).toEqual({ date: new Date(2027, 8, 15), daysUntil: 350, years: 1 });
    expect(nextWorkAnniversary(null, now)).toBeNull();
  });

  it('derives probation status from the end date', () => {
    const now = new Date(2026, 8, 30);
    expect(probationStatus('2024-05-01', now)).toBe('completed');
    expect(probationStatus('2026-09-30', now)).toBe('in_progress');
    expect(probationStatus(null, now)).toBe('none');
  });
});
