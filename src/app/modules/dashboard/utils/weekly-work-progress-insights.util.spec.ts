import { describe, expect, it } from 'vitest';
import { WeekDayProgress, WeekProgress, WeeklyWorkProgressResponse } from '../models/weekly-work-progress.model';
import { buildWeeklyInsights, progressDeltaPoints } from './weekly-work-progress-insights.util';

const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

function day(i: number, patch: Partial<WeekDayProgress> = {}): WeekDayProgress {
  return {
    date: DATES[i], isExpected: i < 5, isHoliday: false, leaveMinutes: 0, expectedMinutes: i < 5 ? 480 : 0,
    scheduledMinutes: 0, workedMinutes: 0, attendanceMinutes: 0, ...patch
  };
}

function week(patch: Partial<WeekProgress> = {}): WeekProgress {
  return {
    expectedMinutes: 2400, expectedToDateMinutes: 1200, scheduledTaskMinutes: 0, scheduledMeetingMinutes: 0, scheduledMinutes: 0,
    loggedTaskMinutes: 0, creditedMeetingMinutes: 0, workedMinutes: 0, attendanceMinutes: 0, remainingMinutes: 2400,
    progressPercent: 0, planningCoveragePercent: 0, scheduleAdherencePercent: null, status: 'no_target',
    days: DATES.map((_, i) => day(i)), ...patch
  };
}

function response(thisWeek: Partial<WeekProgress>, lastWeek: Partial<WeekProgress> = {}, plannerEnabled = true): WeeklyWorkProgressResponse {
  return {
    weekStart: DATES[0], weekEnd: DATES[6], today: '2026-10-29', timezone: 'Asia/Colombo', plannerEnabled,
    thisWeek: week(thisWeek), lastWeek: week(lastWeek),
    tasks: { completedHours: 0, inProgressHours: 0, notStartedHours: 0, unestimatedCount: 0 }
  };
}

const texts = (r: WeeklyWorkProgressResponse) => buildWeeklyInsights(r).map((i) => i.text);

describe('weekly work progress insights', () => {
  it('compares worked hours with last week', () => {
    expect(buildWeeklyInsights(response({ workedMinutes: 1680 }, { workedMinutes: 1500 }))[0]).toEqual({
      tone: 'positive', text: 'Worked 12% more hours than last week.'
    });
    expect(texts(response({ workedMinutes: 1200 }, { workedMinutes: 1500 }))[0]).toBe('Worked 20% fewer hours than last week.');
  });

  it('says nothing about last week when nothing was worked then', () => {
    expect(texts(response({ workedMinutes: 600 }, { workedMinutes: 0 }))).not.toContainEqual(expect.stringContaining('last week'));
  });

  it('reports schedule coverage only while the planner is on', () => {
    expect(texts(response({ planningCoveragePercent: 80 }))).toContain('Schedule coverage is 80%.');
    expect(texts(response({ planningCoveragePercent: 80 }, {}, false))).not.toContain('Schedule coverage is 80%.');
  });

  it('names past days below schedule, or below expected when the planner is off', () => {
    const days = DATES.map((_, i) => day(i));
    days[0] = day(0, { scheduledMinutes: 480, workedMinutes: 480 });
    days[1] = day(1, { scheduledMinutes: 480, workedMinutes: 300 });
    days[2] = day(2, { scheduledMinutes: 240, workedMinutes: 120 });
    days[3] = day(3, { scheduledMinutes: 480, workedMinutes: 0 }); // today: not judged yet
    expect(texts(response({ days }))).toContain('Tue and Wed are below schedule.');

    const offDays = DATES.map((_, i) => day(i, { workedMinutes: i === 0 ? 300 : 480 }));
    expect(texts(response({ days: offDays }, {}, false))).toContain('Mon is below expected.');
  });

  it('turns the status into a sentence', () => {
    expect(buildWeeklyInsights(response({ status: 'on_track' }))).toContainEqual({ tone: 'positive', text: 'On track to meet weekly target.' });
    expect(texts(response({ status: 'ahead' }))).toContain('Ahead of weekly target.');
    expect(buildWeeklyInsights(response({ status: 'behind' }))).toContainEqual({ tone: 'warning', text: 'Behind weekly target.' });
    expect(texts(response({ status: 'no_target' })).some((t) => t.includes('target'))).toBe(false);
  });

  it('points out clocked-in time without task time over an hour', () => {
    expect(texts(response({ attendanceMinutes: 1390, workedMinutes: 1200 }, {}, false))).toContain('Clocked in 3h 10m without task time.');
    expect(texts(response({ attendanceMinutes: 1250, workedMinutes: 1200 }, {}, false)).some((t) => t.startsWith('Clocked in'))).toBe(false);
  });

  it('keeps at most four insights', () => {
    const days = DATES.map((_, i) => day(i, { scheduledMinutes: 480, workedMinutes: i < 3 ? 100 : 0 }));
    const r = response(
      { workedMinutes: 300, planningCoveragePercent: 80, days, status: 'behind', attendanceMinutes: 900 },
      { workedMinutes: 600 }
    );
    expect(buildWeeklyInsights(r)).toHaveLength(4);
  });

  it('gives the progress change in percentage points, or null without last week', () => {
    expect(progressDeltaPoints(response({ progressPercent: 68 }, { progressPercent: 56 }))).toBe(12);
    expect(progressDeltaPoints(response({ progressPercent: 68 }, { progressPercent: 0, expectedMinutes: 0 }))).toBeNull();
  });
});
