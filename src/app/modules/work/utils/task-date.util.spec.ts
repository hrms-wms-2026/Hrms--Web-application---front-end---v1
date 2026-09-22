import { describe, it, expect } from 'vitest';
import { getTaskDueDateInfo } from './task-date.util';

describe('getTaskDueDateInfo', () => {
  // Monday, September 21, 2026
  const now = new Date(2026, 8, 21, 12, 0, 0);

  it('returns null for null, undefined, or invalid dates', () => {
    expect(getTaskDueDateInfo(null, false, now)).toBeNull();
    expect(getTaskDueDateInfo(undefined, false, now)).toBeNull();
    expect(getTaskDueDateInfo('invalid-date', false, now)).toBeNull();
  });

  it('returns "Today" for dates on the same calendar day', () => {
    const today = new Date(2026, 8, 21, 18, 0, 0);
    const info = getTaskDueDateInfo(today, false, now);
    expect(info?.label).toBe('Today');
    expect(info?.isToday).toBe(true);
    expect(info?.isOverdue).toBe(false);
  });

  it('returns "Tomorrow" for the next day', () => {
    const tomorrow = new Date(2026, 8, 22, 10, 0, 0);
    const info = getTaskDueDateInfo(tomorrow, false, now);
    expect(info?.label).toBe('Tomorrow');
    expect(info?.isToday).toBe(false);
    expect(info?.isOverdue).toBe(false);
  });

  it('returns "Yesterday" for the previous day', () => {
    const yesterday = new Date(2026, 8, 20, 10, 0, 0);
    const info = getTaskDueDateInfo(yesterday, false, now);
    expect(info?.label).toBe('Yesterday');
    expect(info?.isOverdue).toBe(true);
  });

  it('does not mark as overdue if task is completed', () => {
    const yesterday = new Date(2026, 8, 20, 10, 0, 0);
    const info = getTaskDueDateInfo(yesterday, true, now);
    expect(info?.label).toBe('Yesterday');
    expect(info?.isOverdue).toBe(false);
  });

  it('returns weekday abbreviation (e.g. "Sat") when date is in current week but not today/tomorrow', () => {
    // Saturday, Sep 26, 2026 is in the same week (Mon Sep 21 - Sun Sep 27)
    const sat = new Date(2026, 8, 26, 9, 0, 0);
    const satInfo = getTaskDueDateInfo(sat, false, now);
    expect(satInfo?.label).toBe('Sat');
    expect(satInfo?.isOverdue).toBe(false);

    // Wednesday, Sep 23, 2026
    const wed = new Date(2026, 8, 23, 15, 0, 0);
    const wedInfo = getTaskDueDateInfo(wed, false, now);
    expect(wedInfo?.label).toBe('Wed');

    // Sunday, Sep 27, 2026
    const sun = new Date(2026, 8, 27, 23, 59, 0);
    const sunInfo = getTaskDueDateInfo(sun, false, now);
    expect(sunInfo?.label).toBe('Sun');
  });

  it('returns "MMM d" when date is outside the current week', () => {
    // Tuesday, Sep 29, 2026 (next week)
    const nextTue = new Date(2026, 8, 29, 10, 0, 0);
    const info = getTaskDueDateInfo(nextTue, false, now);
    expect(info?.label).toBe('Sep 29');
    expect(info?.isOverdue).toBe(false);
  });

  it('includes year if outside current week and different year', () => {
    const nextYear = new Date(2027, 0, 15);
    const info = getTaskDueDateInfo(nextYear, false, now);
    expect(info?.label).toBe('Jan 15, 2027');
  });
});
