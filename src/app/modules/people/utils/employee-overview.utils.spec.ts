import { describe, it, expect } from 'vitest';
import {
  attendanceDayLabel,
  currentMonthKey,
  formatHours,
  formatLeaveRange,
  monthBounds,
  monthLabel,
  recentMonths
} from './employee-overview.utils';

describe('employee-overview.utils', () => {
  it('currentMonthKey zero-pads the month', () => {
    expect(currentMonthKey(new Date(2026, 8, 30))).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });

  it('monthBounds returns the first and real last day', () => {
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('monthLabel uses short English month names', () => {
    expect(monthLabel('2026-09')).toBe('Sep 2026');
    expect(monthLabel('2026-01')).toBe('Jan 2026');
  });

  it('recentMonths lists the current month first and crosses year boundaries', () => {
    const months = recentMonths(new Date(2026, 1, 10), 4);

    expect(months.map((m) => m.value)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(months[0].label).toBe('Feb 2026');
  });

  it('recentMonths defaults to 12 entries', () => {
    expect(recentMonths(new Date(2026, 8, 30))).toHaveLength(12);
  });

  it('formatHours trims trailing zeros', () => {
    expect(formatHours(12)).toBe('12 h');
    expect(formatHours(7.5)).toBe('7.5 h');
    expect(formatHours(0.25)).toBe('0.25 h');
    expect(formatHours(-3)).toBe('-3 h');
  });

  it('formatLeaveRange collapses same-day and same-month ranges', () => {
    expect(formatLeaveRange('2026-09-23', '2026-09-23')).toBe('Sep 23');
    expect(formatLeaveRange('2026-09-23', '2026-09-25')).toBe('Sep 23 – 25');
    expect(formatLeaveRange('2026-09-30', '2026-10-02')).toBe('Sep 30 – Oct 2');
  });

  it('attendanceDayLabel covers every status', () => {
    expect(attendanceDayLabel('present')).toBe('Present');
    expect(attendanceDayLabel('late')).toBe('Late');
    expect(attendanceDayLabel('missing_clock_out')).toBe('Missing clock-out');
    expect(attendanceDayLabel('leave')).toBe('On leave');
    expect(attendanceDayLabel('off')).toBe('Day off');
    expect(attendanceDayLabel('absent')).toBe('Absent');
    expect(attendanceDayLabel('none')).toBe('Upcoming');
  });
});
