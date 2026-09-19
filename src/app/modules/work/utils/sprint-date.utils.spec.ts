import { describe, expect, it } from 'vitest';
import { calculateUpcomingSprintDates } from './sprint-date.utils';

describe('calculateUpcomingSprintDates', () => {
  it('defaults to Monday to Friday of the upcoming week when no settings provided', () => {
    // 2026-09-18 is Friday
    const friday = new Date(2026, 8, 18);
    const result = calculateUpcomingSprintDates(null, friday);

    // Upcoming Monday is 2026-09-21, and finishing work day is Friday 2026-09-25
    expect(result.startDate).toBe('2026-09-21');
    expect(result.endDate).toBe('2026-09-25');
  });

  it('uses today as start date if today is already the start work day', () => {
    // 2026-09-21 is Monday
    const monday = new Date(2026, 8, 21);
    const result = calculateUpcomingSprintDates({ firstDayOfWeek: 1, standardWorkingDays: [1, 2, 3, 4, 5] }, monday);

    expect(result.startDate).toBe('2026-09-21');
    expect(result.endDate).toBe('2026-09-25');
  });

  it('calculates upcoming Monday when called on a weekend', () => {
    // 2026-09-20 is Sunday
    const sunday = new Date(2026, 8, 20);
    const result = calculateUpcomingSprintDates({ firstDayOfWeek: 1, standardWorkingDays: [1, 2, 3, 4, 5] }, sunday);

    expect(result.startDate).toBe('2026-09-21');
    expect(result.endDate).toBe('2026-09-25');
  });

  it('handles custom working days such as Mon-Sat (6-day work week)', () => {
    const monday = new Date(2026, 8, 21);
    const result = calculateUpcomingSprintDates(
      { firstDayOfWeek: 1, standardWorkingDays: [1, 2, 3, 4, 5, 6] },
      monday
    );

    expect(result.startDate).toBe('2026-09-21');
    expect(result.endDate).toBe('2026-09-26');
  });

  it('handles Sunday-Thursday work week (firstDayOfWeek = 7, workingDays = [7, 1, 2, 3, 4])', () => {
    // 2026-09-20 is Sunday
    const sunday = new Date(2026, 8, 20);
    const result = calculateUpcomingSprintDates(
      { firstDayOfWeek: 7, standardWorkingDays: [7, 1, 2, 3, 4] },
      sunday
    );

    expect(result.startDate).toBe('2026-09-20');
    expect(result.endDate).toBe('2026-09-24'); // Thursday is 4 days after Sunday
  });

  it('falls back to first working day if firstDayOfWeek is not in standardWorkingDays', () => {
    // firstDayOfWeek is Sunday (7), but working days are Tue(2) to Sat(6)
    const sunday = new Date(2026, 8, 20);
    const result = calculateUpcomingSprintDates(
      { firstDayOfWeek: 7, standardWorkingDays: [2, 3, 4, 5, 6] },
      sunday
    );

    // Upcoming Tuesday is 2026-09-22, and Saturday is 2026-09-26
    expect(result.startDate).toBe('2026-09-22');
    expect(result.endDate).toBe('2026-09-26');
  });
});
