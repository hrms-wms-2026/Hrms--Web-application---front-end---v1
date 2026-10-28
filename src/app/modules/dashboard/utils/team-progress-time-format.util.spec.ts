import { describe, expect, it } from 'vitest';
import {
  bandShares,
  comparisonText,
  coverageTooltip,
  hoursText,
  minutesText,
  timePeriodFor,
} from './team-progress-time-format.util';
import { ledTime } from './team-progress-time.testing';

describe('Team Progress time format', () => {
  it('compares rates in percentage points, "New" without a previous rate, nothing without a current one', () => {
    expect(comparisonText(80, 74, 'week')).toBe('↑ 6 pp vs last week');
    expect(comparisonText(70, 74.5, 'month')).toBe('↓ 4.5 pp vs last month');
    expect(comparisonText(70, 70, 'week')).toBe('± 0 pp vs last week');
    expect(comparisonText(70, null, 'week')).toBe('New');
    expect(comparisonText(null, 70, 'week')).toBeNull();
  });

  it('minutes and hours text', () => {
    expect(minutesText(200)).toBe('3h 20m');
    expect(hoursText(90)).toBe('1.5 h');
    expect(hoursText(0)).toBe('0 h');
  });

  it('All time reads the week for time figures', () => {
    expect([timePeriodFor('all'), timePeriodFor('week'), timePeriodFor('month')]).toEqual([
      'week',
      'week',
      'month',
    ]);
  });

  it('coverage tooltip names its denominator, or why there is none', () => {
    expect(coverageTooltip(ledTime({ coveragePercent: null }))).toContain('No planned task time');
    expect(coverageTooltip(ledTime({ coveragePercent: 80 }))).toContain('planned task time so far');
  });

  it('band shares scale to the larger of planned and worked', () => {
    expect(
      bandShares(
        ledTime({
          plannedMinutes: 100,
          clockedMinutes: 200,
          scheduledMinutes: 50,
          outsideSlotMinutes: 50,
          noPlanMinutes: 100,
        }),
      ),
    ).toEqual({
      scheduled: 25,
      outside: 25,
      noPlan: 50,
      plannedMarker: 50,
    });
    expect(bandShares(ledTime({ plannedMinutes: 0, clockedMinutes: 0 })).plannedMarker).toBe(0);
  });
});
