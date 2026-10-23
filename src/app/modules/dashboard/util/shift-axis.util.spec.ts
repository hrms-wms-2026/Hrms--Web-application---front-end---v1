import { describe, expect, it } from 'vitest';
import { buildDayBlocks, buildShiftAxis } from './shift-axis.util';

// Fixed UTC instants, timezone UTC, so nothing depends on the machine's clock or zone.
const at = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00Z`).getTime();

const shift = {
  workDate: '2026-10-22',
  timezone: 'UTC',
  scheduledStartTime: '09:00',
  scheduledEndTime: '18:00',
  requiredWorkMinutes: 480,
  clockInAt: '2026-10-22T09:00:00Z',
  clockOutAt: null
};

describe('buildShiftAxis', () => {
  it('runs from shift start to shift end, with worked time up to now and a now marker', () => {
    const axis = buildShiftAxis(shift, at('13:30'))!;
    expect(axis.start).toBe(at('09:00'));
    expect(axis.end).toBe(at('18:00'));
    expect(axis.offsetPct).toBe(0);
    expect(axis.workedPct).toBe(50);
    expect(axis.nowPct).toBe(50);
    expect(axis.ticks.map((t) => t.label)).toEqual(['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM']);
    expect(axis.ticks[0].pct).toBe(0);
    expect(axis.ticks[9].pct).toBe(100);
  });

  it('leaves a late clock-in gap before the worked span', () => {
    const axis = buildShiftAxis({ ...shift, clockInAt: '2026-10-22T10:48:00Z' }, at('13:30'))!;
    expect(axis.offsetPct).toBe(20);
    expect(axis.workedPct).toBe(30);
  });

  it('stretches to take in an early start and overtime, and drops the marker after clock-out', () => {
    const axis = buildShiftAxis({ ...shift, clockInAt: '2026-10-22T08:00:00Z', clockOutAt: '2026-10-22T19:00:00Z' }, at('20:00'))!;
    expect(axis.start).toBe(at('08:00'));
    expect(axis.end).toBe(at('19:00'));
    expect(axis.workedPct).toBe(100);
    expect(axis.nowPct).toBeNull();
  });

  it('shows the whole shift as still to come before clock-in', () => {
    const axis = buildShiftAxis({ ...shift, clockInAt: null }, at('08:30'))!;
    expect(axis.workedPct).toBe(0);
    expect(axis.nowPct).toBeNull();
  });

  it('uses clock-in plus the required time without a schedule, and nothing without either', () => {
    const axis = buildShiftAxis({ ...shift, scheduledStartTime: null, scheduledEndTime: null, clockInAt: '2026-10-22T09:30:00Z' }, at('11:30'))!;
    expect(axis.start).toBe(at('09:30'));
    expect(axis.end).toBe(at('17:30'));
    expect(axis.workedPct).toBe(25);
    expect(axis.ticks[0].label).toBe('10:00 AM');
    expect(buildShiftAxis({ ...shift, scheduledStartTime: null, clockInAt: null }, at('11:30'))).toBeNull();
  });

  it('places hour ticks on the whole hours of a half-hour timezone', () => {
    const axis = buildShiftAxis({ ...shift, timezone: 'Asia/Colombo', clockInAt: '2026-10-22T03:30:00Z' }, at('05:00'))!;
    // 09:00-18:00 Colombo (UTC+5:30) = 03:30-12:30 UTC; ticks at 09:00, 10:00 ... Colombo.
    expect(axis.ticks[0]).toEqual({ pct: 0, label: '9:00 AM' });
    expect(axis.ticks).toHaveLength(10);
  });
});

describe('buildDayBlocks', () => {
  const axis = buildShiftAxis(shift, at('15:00'))!; // 09:00-18:00, 5.4 minutes per percent
  const iso = (hhmm: string) => `2026-10-22T${hhmm}:00Z`;
  const simple = (blocks: ReturnType<typeof buildDayBlocks>) => blocks.map((b) => `${b.type}:${b.leftPct.toFixed(1)}+${b.widthPct.toFixed(1)}`);

  it('is one working block from clock-in to now without breaks or leave', () => {
    expect(simple(buildDayBlocks(axis, shift, [], [], at('15:00')))).toEqual(['working:0.0+66.7']);
  });

  it('cuts breaks and leave out of working, in time order', () => {
    const blocks = buildDayBlocks(
      axis,
      shift,
      [{ start: iso('11:15'), end: iso('12:00') }],
      [{ start: iso('13:00'), end: iso('13:45') }],
      at('15:00')
    );
    expect(blocks.map((b) => b.type)).toEqual(['working', 'break', 'working', 'leave', 'working']);
    expect(simple(blocks)[1]).toBe('break:25.0+8.3');
    expect(simple(blocks)[3]).toBe('leave:44.4+8.3');
  });

  it('runs an open break to now and shows leave later in the day as well', () => {
    const blocks = buildDayBlocks(axis, shift, [{ start: iso('14:30'), end: null }], [{ start: iso('16:00'), end: iso('18:00') }], at('15:00'));
    expect(simple(blocks)).toEqual(['working:0.0+61.1', 'break:61.1+5.6', 'leave:77.8+22.2']);
  });

  it('shows leave but no working before clock-in, and clips leave to the bar', () => {
    const blocks = buildDayBlocks(axis, { clockInAt: null, clockOutAt: null }, [], [{ start: '2026-10-21T00:00:00Z', end: iso('13:00') }], at('10:00'));
    expect(simple(blocks)).toEqual(['leave:0.0+44.4']);
  });
});
