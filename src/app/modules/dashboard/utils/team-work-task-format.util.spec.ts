import { describe, expect, it } from 'vitest';
import {
  compactHoursText,
  hoursText,
  teamWorkTaskCaption,
  teamWorkTaskDelta,
  teamWorkTaskRangeLabel,
  teamWorkTaskSlices,
  trendLabel,
  utilizationText,
} from './team-work-task-format.util';

describe('team-work-task-format', () => {
  it('splits working time into task, other work and break', () => {
    const slices = teamWorkTaskSlices({
      workedMinutes: 480,
      breakMinutes: 60,
      taskMinutes: 300,
      completedTasks: 3,
      unestimatedTasks: 0,
      utilization: 62.5,
    });
    expect(slices.map((s) => [s.key, s.minutes, s.percent])).toEqual([
      ['task', 300, 56],
      ['other', 180, 33],
      ['break', 60, 11],
    ]);
  });

  it('caps task time at the working time so other work is never negative', () => {
    const slices = teamWorkTaskSlices({
      workedMinutes: 120,
      breakMinutes: 0,
      taskMinutes: 300,
      completedTasks: 1,
      unestimatedTasks: 0,
      utilization: 250,
    });
    expect(slices.map((s) => s.minutes)).toEqual([120, 0, 0]);
  });

  it('shortens tile hours from 10h up so they fit on one line', () => {
    expect(compactHoursText(330)).toBe('5h 30m');
    expect(compactHoursText(599)).toBe('9h 59m');
    expect(compactHoursText(40391)).toBe('673h');
    expect(compactHoursText(3186)).toBe('53h');
    expect(compactHoursText(90000)).toBe('1,500h');
  });

  it('formats hours and utilization', () => {
    expect(hoursText(0)).toBe('0h');
    expect(hoursText(90)).toBe('1h 30m');
    expect(utilizationText(null)).toBe('—');
    expect(utilizationText(0.05)).toBe('<0.1%');
    expect(utilizationText(7.25)).toBe('7.3%');
    expect(utilizationText(62.5)).toBe('63%');
    expect(utilizationText(125)).toBe('125%');
  });

  it('describes the change against the previous period', () => {
    expect(teamWorkTaskDelta(50, 45, 'week')).toEqual({ text: '↑ 5 pp vs last week', down: false });
    expect(teamWorkTaskDelta(40, 45.5, 'day')).toEqual({
      text: '↓ 5.5 pp vs yesterday',
      down: true,
    });
    expect(teamWorkTaskDelta(40, 40, 'month')).toEqual({ text: 'Same as last month', down: false });
    expect(teamWorkTaskDelta(null, 40, 'week')).toBeNull();
  });

  it('labels each period', () => {
    expect(teamWorkTaskRangeLabel('day', '2026-09-30', '2026-09-30')).toBe('Wed 30 Sep 2026');
    expect(teamWorkTaskRangeLabel('week', '2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct 2026');
    expect(teamWorkTaskRangeLabel('week', '2026-10-05', '2026-10-11')).toBe('5 – 11 Oct 2026');
    expect(teamWorkTaskRangeLabel('month', '2026-09-01', '2026-09-30')).toBe('September 2026');
    expect(teamWorkTaskCaption('day')).toContain('today');
    expect(trendLabel('2026-09-30', false)).toBe('Wed');
    expect(trendLabel('2026-09-30', true)).toBe('30');
  });
});
