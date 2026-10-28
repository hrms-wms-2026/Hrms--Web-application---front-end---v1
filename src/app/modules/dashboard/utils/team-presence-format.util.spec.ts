import { describe, expect, it } from 'vitest';
import { groupPresence, minutesText, neutralLine, orderPresence, presenceState, timeLeft } from './team-presence-format.util';
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
      member('not_scheduled')
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
      '4 not clocked in · 2 clocked out · 1 not scheduled'
    );
    expect(neutralLine({ notClockedIn: 0, clockedOut: 0, absent: 0, notScheduled: 0 })).toBe('');
  });

  it('orders working, break, leave, then the rest, by name inside each', () => {
    const ordered = orderPresence([
      member('clocked_out', { displayName: 'A' }),
      member('on_leave', { displayName: 'B' }),
      member('working', { displayName: 'Z' }),
      member('on_break', { displayName: 'C' }),
      member('working', { displayName: 'D' })
    ]);

    expect(ordered.map((m) => m.displayName)).toEqual(['D', 'Z', 'C', 'B', 'A']);
  });

  it('minutesText', () => {
    expect([minutesText(0), minutesText(45), minutesText(60), minutesText(200)]).toEqual(['0m', '45m', '1h', '3h 20m']);
  });

  it('time left needs a denominator: a break allowance or a scheduled end', () => {
    expect(timeLeft(member('on_break', { stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: null }), NOW)).toBeNull();
    expect(timeLeft(member('working', { stateSince: '2026-10-29T04:00:00Z', shiftEndsAt: null }), NOW)).toBeNull();
    expect(timeLeft(member('on_leave'), NOW)).toBeNull();

    const onBreak = timeLeft(member('on_break', { stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: 30 }), NOW);
    expect(onBreak).toEqual({ text: '30m break left', usedPercent: 25 });

    const working = timeLeft(member('working', { stateSince: '2026-10-29T06:00:00Z', shiftEndsAt: '2026-10-29T14:00:00Z' }), NOW);
    expect(working).toEqual({ text: '4h of shift left', usedPercent: 50 });
  });
});
