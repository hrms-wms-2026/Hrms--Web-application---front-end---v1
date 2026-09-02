import { addCalendarMonths } from './calendar-date.utils';

describe('addCalendarMonths', () => {
  it('adds months within the same year', () => {
    expect(addCalendarMonths('2026-05-01', 2)).toBe('2026-07-01');
  });

  it('rolls over into the next year', () => {
    expect(addCalendarMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('rolls back into the previous year', () => {
    expect(addCalendarMonths('2026-02-10', -3)).toBe('2025-11-10');
  });

  it('supports a zero-month no-op', () => {
    expect(addCalendarMonths('2026-05-01', 0)).toBe('2026-05-01');
  });
});
