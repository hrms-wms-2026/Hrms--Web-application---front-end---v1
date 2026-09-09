import { describe, expect, it } from 'vitest';
import { formatDaysAtWorkDayHours, formatHours, formatHoursLabel, formatLeaveDateTime, formatLeaveRange } from './leave-hours-format';

describe('leave-hours-format', () => {
  it('trims trailing zeros up to two decimals', () => {
    expect(formatHours(4)).toBe('4');
    expect(formatHours(4.5)).toBe('4.5');
    expect(formatHours(4.25)).toBe('4.25');
    expect(formatHours(8.0)).toBe('8');
  });

  it('suffixes hours with h', () => {
    expect(formatHoursLabel(4)).toBe('4h');
    expect(formatHoursLabel(4.5)).toBe('4.5h');
  });

  it('formats an afternoon window in UTC', () => {
    expect(formatLeaveDateTime('2026-09-09T14:00:00.000Z')).toBe('9 Sep 14:00');
    expect(formatLeaveDateTime('2026-09-09T18:00:00.000Z')).toBe('9 Sep 18:00');
  });

  it('formats an instant in the legal-entity timezone', () => {
    expect(formatLeaveDateTime('2026-09-09T08:30:00.000Z', 'Asia/Colombo')).toBe('9 Sep 14:00');
  });

  it('formats an overnight window in UTC', () => {
    expect(formatLeaveDateTime('2026-09-12T22:00:00.000Z')).toBe('12 Sep 22:00');
    expect(formatLeaveDateTime('2026-09-13T06:00:00.000Z')).toBe('13 Sep 06:00');
  });

  it('joins startAt and endAt with an arrow', () => {
    expect(formatLeaveRange('2026-09-09T14:00:00.000Z', '2026-09-09T18:00:00.000Z')).toBe('9 Sep 14:00 → 9 Sep 18:00');
  });

  it('shows entitled hours as days at the work-day rate', () => {
    expect(formatDaysAtWorkDayHours(112, 8)).toBe('14 days at 8.0h/day');
  });
});
