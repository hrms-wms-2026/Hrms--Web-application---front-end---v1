import { describe, it, expect } from 'vitest';
import {
  attendanceDayLabel,
  computeDelta,
  currentMonthKey,
  formatHours,
  formatLeaveRange,
  formatMinutes,
  formatShortDate,
  monthBounds,
  monthKeyOf,
  monthLabel,
  monthsBetween,
  recentMonths,
  shiftMonth
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

describe('formatMinutes', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatMinutes(0)).toBe('0h 00m');
    expect(formatMinutes(65)).toBe('1h 05m');
    expect(formatMinutes(150)).toBe('2h 30m');
    expect(formatMinutes(4999)).toBe('83h 19m');
  });

  it('clamps negatives and rounds fractions', () => {
    expect(formatMinutes(-5)).toBe('0h 00m');
    expect(formatMinutes(59.6)).toBe('1h 00m');
  });
});

describe('computeDelta', () => {
  it('reports no change as flat and neutral', () => {
    expect(computeDelta(5, 5, 'higher-better')).toEqual({ text: 'No change', direction: 'flat', tone: 'neutral' });
  });

  it('marks an increase good when higher is better and bad when lower is better', () => {
    expect(computeDelta(10, 8, 'higher-better')).toEqual({ text: '+2', direction: 'up', tone: 'good' });
    expect(computeDelta(10, 8, 'lower-better')).toEqual({ text: '+2', direction: 'up', tone: 'bad' });
  });

  it('marks a decrease bad when higher is better and good when lower is better', () => {
    expect(computeDelta(3, 8, 'higher-better')).toEqual({ text: '-5', direction: 'down', tone: 'bad' });
    expect(computeDelta(3, 8, 'lower-better')).toEqual({ text: '-5', direction: 'down', tone: 'good' });
  });

  it('keeps the tone neutral for neutral polarity, and formats the magnitude with the given formatter', () => {
    expect(computeDelta(90, 60, 'neutral', formatMinutes)).toEqual({ text: '+0h 30m', direction: 'up', tone: 'neutral' });
  });
});

describe('formatShortDate', () => {
  it('formats an ISO date or datetime from its string parts', () => {
    expect(formatShortDate('2026-09-12')).toBe('Sep 12');
    expect(formatShortDate('2026-09-01T23:30:00+00:00')).toBe('Sep 1');
    expect(formatShortDate('2026-12-31T00:00:00Z')).toBe('Dec 31');
  });
});

describe('month range helpers', () => {
  it('monthKeyOf takes the YYYY-MM prefix', () => expect(monthKeyOf('2024-02-01')).toBe('2024-02'));

  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });

  it('monthsBetween is inclusive and newest first', () => {
    expect(monthsBetween('2026-07', '2026-09').map((m) => m.value)).toEqual(['2026-09', '2026-08', '2026-07']);
  });

  it('monthsBetween is empty when inverted', () => expect(monthsBetween('2026-10', '2026-09')).toEqual([]));
});
