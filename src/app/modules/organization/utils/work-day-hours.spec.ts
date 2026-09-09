import { describe, expect, it } from 'vitest';
import { computeWorkDayHours, isOvernightWorkWindow } from './work-day-hours';

describe('computeWorkDayHours', () => {
  it('returns null when either time is missing', () => {
    expect(computeWorkDayHours(null, '18:00', 60)).toBeNull();
    expect(computeWorkDayHours('09:00', '', 60)).toBeNull();
  });

  it('subtracts break on a same-day window', () => {
    expect(computeWorkDayHours('09:00', '18:00', 60)).toBe(8);
  });

  it('counts overnight 22:00-06:00 as 8 hours', () => {
    expect(computeWorkDayHours('22:00', '06:00', 0)).toBe(8);
    expect(isOvernightWorkWindow('22:00', '06:00')).toBe(true);
  });

  it('returns a non-positive value when break covers the shift', () => {
    expect(computeWorkDayHours('09:00', '10:00', 120)).toBe(-1);
  });
});
