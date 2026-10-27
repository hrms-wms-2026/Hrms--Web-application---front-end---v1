import { CalendarEventResponse } from '../models/calendar-event.model';
import { layoutDayEvents, layoutDayItems } from './calendar-hour-grid.util';

function makeEvent(id: string, startHHmm: string, endHHmm: string, isAllDay = false): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: `2026-09-01T${startHHmm}:00Z`, endDate: `2026-09-01T${endHHmm}:00Z`,
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null, hasConflict: false
  };
}

const dayStart = new Date('2026-09-01T00:00:00Z');

describe('layoutDayEvents', () => {
  it('excludes all-day events', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00', true)], dayStart);
    expect(result).toEqual([]);
  });

  it('positions a single event at the correct top/height fraction, full width', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00')], dayStart);
    expect(result).toHaveLength(1);
    expect(result[0].top).toBeCloseTo(9 * 60 / 1440);
    expect(result[0].height).toBeCloseTo(60 / 1440);
    expect(result[0].left).toBe(0);
    expect(result[0].width).toBe(1);
  });

  it('gives non-overlapping sequential events full width each', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00'), makeEvent('b', '11:00', '12:00')], dayStart);
    expect(result.every((p) => p.width === 1 && p.left === 0)).toBe(true);
  });

  it('splits two directly-overlapping events into two half-width columns', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00'), makeEvent('b', '09:30', '10:30')], dayStart);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.width === 0.5)).toBe(true);
    const lefts = result.map((p) => p.left).sort();
    expect(lefts).toEqual([0, 0.5]);
  });

  it('lets a later event reuse a column once its predecessor in that column has ended', () => {
    // a: 09:00-10:00, b: 09:30-11:00 (overlaps a), c: 10:30-11:30 (overlaps b only, not a)
    // a and c can share a column; b needs its own -> 2 columns total
    const result = layoutDayEvents(
      [makeEvent('a', '09:00', '10:00'), makeEvent('b', '09:30', '11:00'), makeEvent('c', '10:30', '11:30')],
      dayStart
    );
    const widths = new Set(result.map((p) => p.width));
    expect(widths).toEqual(new Set([0.5]));
  });

  it('clamps a start before dayStart and an end after dayStart+24h to the visible column', () => {
    const spanning = makeEvent('a', '09:00', '10:00');
    (spanning as { startDate: string }).startDate = '2026-08-31T23:00:00Z'; // starts the day before
    (spanning as { endDate: string }).endDate = '2026-09-02T01:00:00Z'; // ends the day after
    const result = layoutDayEvents([spanning], dayStart);
    expect(result[0].top).toBe(0);
    expect(result[0].height).toBe(1);
  });

  it('sorts by start time regardless of input order', () => {
    const result = layoutDayEvents([makeEvent('late', '14:00', '15:00'), makeEvent('early', '09:00', '10:00')], dayStart);
    expect(result[0].event.id).toBe('early');
    expect(result[1].event.id).toBe('late');
  });
});

describe('layoutDayItems', () => {
  it('puts an overlapping planner block and event side by side', () => {
    const event = makeEvent('meeting', '10:00', '11:00');
    const block = { id: 'b1', startAt: '2026-09-01T09:00:00Z', endAt: '2026-09-01T10:30:00Z' };

    const result = layoutDayItems([
      { kind: 'event', event, start: event.startDate, end: event.endDate },
      { kind: 'block', block: block as never, start: block.startAt, end: block.endAt },
    ], dayStart);

    expect(result.map((p) => [p.item.kind, p.left, p.width])).toEqual([['block', 0, 0.5], ['event', 0.5, 0.5]]);
  });

  it('lays out blocks alone the same way as events alone', () => {
    const event = makeEvent('e', '09:00', '10:00');
    const asEvent = layoutDayEvents([event], dayStart)[0];
    const asBlock = layoutDayItems([{ kind: 'block', block: {} as never, start: event.startDate, end: event.endDate }], dayStart)[0];

    expect([asBlock.top, asBlock.height, asBlock.left, asBlock.width]).toEqual([asEvent.top, asEvent.height, asEvent.left, asEvent.width]);
  });
});
