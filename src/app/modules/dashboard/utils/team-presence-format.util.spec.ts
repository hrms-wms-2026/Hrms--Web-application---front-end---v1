import { describe, expect, it } from 'vitest';
import {
  breakMinutes,
  groupPresence,
  hoursBreakdown,
  minutesLeft,
  minutesText,
  neutralLine,
  orderPresence,
  presenceFromSummary,
  presencePill,
  presenceState,
  timeLeft,
  todayHoursText,
  todayProgress,
} from './team-presence-format.util';
import { presenceMember } from './team-presence.testing';

const member = presenceMember;
const NOW = new Date('2026-10-29T10:00:00Z');

describe('Working / Break / Leave format', () => {
  it('groupPresence counts only working, on_break and on_leave in the three states', () => {
    const groups = groupPresence([
      member('working', { displayName: 'a' }),
      member('working', { displayName: 'b' }),
      member('on_break'),
      member('on_leave'),
      member('not_started'),
      member('clocked_out'),
      member('absent'),
      member('not_scheduled'),
    ]);

    expect([groups.working, groups.onBreak, groups.onLeave]).toEqual([2, 1, 1]);
    expect(groups.neutral).toEqual({ notClockedIn: 1, clockedOut: 1, absent: 1, notScheduled: 1 });
  });

  it('a masked leave (absent, no leave block) lands in neutral, never in Leave', () => {
    const groups = groupPresence([member('absent', { leave: null })]);

    expect(groups.onLeave).toBe(0);
    expect(groups.neutral.absent).toBe(1);
    expect(presenceState('absent')).toBeNull();
  });

  it('joins the neutral counts in copy and drops zeros', () => {
    expect(neutralLine({ notClockedIn: 4, clockedOut: 2, absent: 0, notScheduled: 1 })).toBe(
      '4 not clocked in · 2 clocked out · 1 not scheduled',
    );
    expect(neutralLine({ notClockedIn: 0, clockedOut: 0, absent: 0, notScheduled: 0 })).toBe('');
  });

  it('orders working, break, leave, then the rest, by name inside each', () => {
    const ordered = orderPresence([
      member('clocked_out', { displayName: 'A' }),
      member('on_leave', { displayName: 'B' }),
      member('working', { displayName: 'Z' }),
      member('on_break', { displayName: 'C' }),
      member('working', { displayName: 'D' }),
    ]);

    expect(ordered.map((m) => m.displayName)).toEqual(['D', 'Z', 'C', 'B', 'A']);
  });

  it('minutesText', () => {
    expect([minutesText(0), minutesText(45), minutesText(60), minutesText(200)]).toEqual([
      '0m',
      '45m',
      '1h',
      '3h 20m',
    ]);
  });

  it('time left needs a denominator: a break allowance or a scheduled end', () => {
    expect(
      timeLeft(
        member('on_break', { stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: null }),
        NOW,
      ),
    ).toBeNull();
    expect(
      timeLeft(member('working', { stateSince: '2026-10-29T04:00:00Z', shiftEndsAt: null }), NOW),
    ).toBeNull();
    expect(timeLeft(member('on_leave'), NOW)).toBeNull();

    const onBreak = timeLeft(
      member('on_break', { stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: 30 }),
      NOW,
    );
    expect(onBreak).toEqual({ text: '30m break left', usedPercent: 25 });

    const working = timeLeft(
      member('working', {
        stateSince: '2026-10-29T06:00:00Z',
        shiftEndsAt: '2026-10-29T14:00:00Z',
      }),
      NOW,
    );
    expect(working).toEqual({ text: '4h of shift left', usedPercent: 50 });
  });
});

describe('Working / Break / Leave format (coverage audit)', () => {
  const NOW2 = new Date('2026-10-29T10:00:00Z');

  it('a break allowance used up shows 0m left and a full bar, never negative', () => {
    expect(
      timeLeft(presenceMember('on_break', { stateSince: '2026-10-29T09:00:00Z', breakRemainingMinutes: 0 }), NOW2),
    ).toEqual({ text: '0m break left', usedPercent: 100 });
  });

  it('past the shift end shows 0m left, never a negative time', () => {
    expect(
      timeLeft(
        presenceMember('working', { stateSince: '2026-10-29T01:00:00Z', shiftEndsAt: '2026-10-29T09:00:00Z' }),
        NOW2,
      ),
    ).toEqual({ text: '0m of shift left', usedPercent: 100 });
  });

  it('todayHoursText is attended of the work window, or attended alone without one', () => {
    expect(todayHoursText(member('working', { attendanceMinutes: 360, expectedMinutes: 480 }))).toBe('6h / 8h');
    expect(todayHoursText(member('working', { attendanceMinutes: 330, expectedMinutes: 480 }))).toBe('5h 30m / 8h');
    expect(todayHoursText(member('working', { attendanceMinutes: 360, expectedMinutes: null }))).toBe('6h');
    // Overtime stays uncapped in text.
    expect(todayHoursText(member('working', { attendanceMinutes: 540, expectedMinutes: 480 }))).toBe('9h / 8h');
  });

  it('todayProgress is capped at 100 and null without a work window', () => {
    expect(todayProgress(member('working', { attendanceMinutes: 360, expectedMinutes: 480 }))).toBe(75);
    expect(todayProgress(member('working', { attendanceMinutes: 540, expectedMinutes: 480 }))).toBe(100);
    expect(todayProgress(member('working', { attendanceMinutes: 60, expectedMinutes: null }))).toBeNull();
    expect(todayProgress(member('on_leave', { attendanceMinutes: 0, expectedMinutes: 0 }))).toBeNull();
  });

  it('presencePill names the working count, singular and plural', () => {
    const summary = { total: 9, working: 8, onBreak: 1, clockedOut: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0 };
    expect(presencePill(presenceFromSummary(summary))).toBe('8 employees are currently working');
    expect(presencePill(presenceFromSummary({ ...summary, working: 1 }))).toBe('1 employee is currently working');
    expect(presencePill(presenceFromSummary({ ...summary, working: 0 }))).toBe('No one is working right now');
  });

  it('minutesLeft matches the time-left figure and is null without a denominator', () => {
    const working = member('working', {
      stateSince: '2026-10-29T03:30:00Z',
      shiftEndsAt: '2026-10-29T12:30:00Z',
    });
    expect(minutesLeft(working, NOW)).toBe(150);
    expect(minutesLeft(member('on_break', { stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: 20 }), NOW)).toBe(20);
    expect(minutesLeft(member('on_break', { breakRemainingMinutes: null }), NOW)).toBeNull();
  });

  it('breakMinutes sums closed breaks and runs an open one to now', () => {
    const m = member('on_break', {
      breaks: [
        { start: '2026-10-29T08:00:00Z', end: '2026-10-29T08:15:00Z' },
        { start: '2026-10-29T09:50:00Z', end: null },
      ],
    });
    expect(breakMinutes(m, NOW)).toBe(25);
  });

  it('hoursBreakdown totals worked, break and leave minutes, never mixing people counts', () => {
    const totals = hoursBreakdown(
      [
        member('working', { attendanceMinutes: 360 }),
        member('on_break', { attendanceMinutes: 120, breaks: [{ start: '2026-10-29T08:00:00Z', end: '2026-10-29T08:15:00Z' }] }),
        member('on_leave', { leaveMinutes: 480 }),
      ],
      NOW,
    );
    expect(totals).toEqual({ worked: 480, break: 15, leave: 480 });
  });
});
