import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  formatWorkAreaDate,
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
});
