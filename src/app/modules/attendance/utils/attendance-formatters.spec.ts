import { describe, expect, it } from 'vitest';
import {
  formatClockTime,
  formatDate,
  formatDateTime,
  formatMinutes,
  formatWorkAreaDate,
  fullDateLabel,
  greetingForTime,
  sourceLabel,
  statusLabel,
  timelineEventLabel,
  workModeLabel
} from './attendance-formatters';

describe('attendance-formatters', () => {
  it('formatDate renders a short month/day/year in UTC', () => {
    const expected = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 7, 27, 12)));
    expect(formatDate('2026-08-27')).toBe(expected);
  });

  it('formatDate rejects a malformed date', () => {
    expect(formatDate('not-a-date')).toBe('Date unavailable');
  });

  it('formatDateTime renders a time in the given timezone', () => {
    const expected = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date('2026-08-27T10:00:00Z'));
    expect(formatDateTime('2026-08-27T10:00:00Z', 'UTC')).toBe(expected);
  });

  it('formatDateTime returns an em dash for a null value', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('formatClockTime renders a 12-hour clock in the given timezone', () => {
    const expected = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date('2026-08-27T10:00:00Z'));
    expect(formatClockTime('2026-08-27T10:00:00Z', 'UTC')).toBe(expected);
    expect(formatClockTime(null)).toBe('—');
  });

  it('formatMinutes renders hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(null)).toBe('—');
  });

  it('workModeLabel maps known codes and falls back for null', () => {
    expect(workModeLabel('onsite')).toBe('Onsite');
    expect(workModeLabel(null)).toBe('Not specified');
  });

  it('sourceLabel maps known codes and falls back for null', () => {
    expect(sourceLabel('desktop_tray')).toBe('Desktop tray');
    expect(sourceLabel(null)).toBe('—');
  });

  it('statusLabel prefers the backend label when present, otherwise humanizes the code', () => {
    expect(statusLabel('clocked_in', 'Custom label')).toBe('Custom label');
    expect(statusLabel('clocked_in')).toBe('Clocked in');
    expect(statusLabel('over_break', 'Over break allowance')).toBe('Over break');
    expect(statusLabel('over_break_allowance')).toBe('Over break');
    expect(statusLabel('over_break')).toBe('Over break');
  });

  it('timelineEventLabel maps each known event type', () => {
    expect(timelineEventLabel('ClockIn')).toBe('Clocked in');
    expect(timelineEventLabel('ClockOut')).toBe('Clocked out');
    expect(timelineEventLabel('BreakStart')).toBe('Break started');
    expect(timelineEventLabel('BreakEnd')).toBe('Break ended');
  });

  it('formatWorkAreaDate renders a date in the given timezone, falling back to formatDate for an invalid value', () => {
    const expected = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 7, 27, 12)));
    expect(formatWorkAreaDate('2026-08-27', 'UTC')).toBe(expected);
    expect(formatWorkAreaDate('not-a-date', 'UTC')).toBe('Date unavailable');
  });

  it('fullDateLabel renders weekday, month, day, and year in UTC', () => {
    const expected = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 8, 8, 12)));
    expect(fullDateLabel('2026-09-08')).toBe(expected);
    expect(fullDateLabel('not-a-date')).toBe('Date unavailable');
  });

  it('greetingForTime picks a greeting from the company-local hour, not the browser hour', () => {
    expect(greetingForTime(new Date('2026-09-08T02:00:00Z'), 'UTC')).toBe('Good morning');
    expect(greetingForTime(new Date('2026-09-08T14:00:00Z'), 'UTC')).toBe('Good afternoon');
    expect(greetingForTime(new Date('2026-09-08T20:00:00Z'), 'UTC')).toBe('Good evening');
    // 02:00 UTC is 07:30 in Asia/Colombo (UTC+5:30) - still morning there, not the UTC hour.
    expect(greetingForTime(new Date('2026-09-08T02:00:00Z'), 'Asia/Colombo')).toBe('Good morning');
  });

  it('date-only formatters reject impossible calendar dates and format a second valid date', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-8-27', '']) {
      expect(formatDate(bad)).toBe('Date unavailable');
      expect(fullDateLabel(bad)).toBe('Date unavailable');
    }
    expect(formatDate('2024-02-29')).toBe(new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 1, 29, 12))));
    expect(fullDateLabel('2024-02-29')).toBe(new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 1, 29, 12))));
  });

  it('time formatters return an em dash for bad input and honour the timezone', () => {
    for (const fn of [formatDateTime, formatClockTime]) {
      expect(fn('', 'UTC')).toBe('—');
      expect(fn('garbage', 'UTC')).toBe('—');
      expect(fn('2026-08-27T10:00:00Z', 'Not/AZone')).toBe('—');
    }
    const at = new Date('2026-08-27T23:30:00Z');
    expect(formatDateTime('2026-08-27T23:30:00Z', 'Asia/Tokyo')).toBe(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(at));
    expect(formatClockTime('2026-08-27T23:30:00Z', 'Asia/Tokyo')).toBe(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Tokyo' }).format(at));
    expect(formatDateTime('2026-08-27T23:30:00Z')).toBe(formatDateTime('2026-08-27T23:30:00Z', 'UTC'));
  });
});
