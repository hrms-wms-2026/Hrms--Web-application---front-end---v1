import { CalendarEventResponse } from '../models/calendar-event.model';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../work/planner/models/planner.models';
import {
  blockRange, busyIntervals, dayLoad, dropLength, moveAfterSlot, overlapSegments, windowMinutes,
} from './planner-grid.util';

const TZ = 'Asia/Colombo';
const ME = 'emp-me';

/** An ISO instant for a Colombo wall-clock time. */
const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

function event(id: string, date: string, from: string, to: string, extra: Partial<CalendarEventResponse> = {}): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: at(date, from), endDate: at(date, to), sourceType: 'manual', color: null,
    recurrence: 'none', isAllDay: false, timezone: TZ, eventStatus: null, isPrivate: false, location: null, meetingLink: null,
    externalSource: null, createdById: ME, isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
    participants: null, ...extra,
  } as CalendarEventResponse;
}

describe('planner grid maths', () => {
  describe('busyIntervals', () => {
    it('keeps timed events and leaves out all-day, cancelled and ones I declined', () => {
      const events = [
        event('sync', '2026-11-02', '10:00', '11:00'),
        event('holiday', '2026-11-02', '00:00', '23:59', { isAllDay: true }),
        event('cancelled meeting', '2026-11-02', '12:00', '13:00', { itemKind: 'meeting', meetingStatus: 'cancelled' }),
        event('cancelled event', '2026-11-02', '13:00', '14:00', { eventStatus: 'cancelled' }),
        event('declined', '2026-11-02', '14:00', '15:00',
          { participants: [{ employeeId: ME, employeeName: 'Me', responseStatus: 'declined' }] }),
        event('they declined', '2026-11-02', '15:00', '16:00',
          { participants: [{ employeeId: 'other', employeeName: 'Other', responseStatus: 'declined' }] }),
      ];

      const busy = busyIntervals(events, ME, '2026-11-02', TZ);

      expect(busy.map((b) => [b.eventId, b.start, b.end])).toEqual([['sync', 600, 660], ['they declined', 900, 960]]);
    });

    it('clips a meeting that crosses midnight to each day', () => {
      const late = { ...event('late', '2026-11-02', '23:00', '23:00'), endDate: at('2026-11-03', '01:00') };

      expect(busyIntervals([late], ME, '2026-11-02', TZ).map((b) => [b.start, b.end])).toEqual([[1380, 1440]]);
      expect(busyIntervals([late], ME, '2026-11-03', TZ).map((b) => [b.start, b.end])).toEqual([[0, 60]]);
      expect(busyIntervals([late], ME, '2026-11-04', TZ)).toEqual([]);
    });
  });

  it('blockRange gives a block\'s minutes on its day', () => {
    const block = { startAt: at('2026-11-02', '09:00'), endAt: at('2026-11-02', '10:30') } as PlannerRangeBlockView;

    expect(blockRange(block, '2026-11-02', TZ)).toEqual({ start: 540, end: 630 });
  });

  it('overlapSegments returns the part of a block a busy item covers', () => {
    expect(overlapSegments({ start: 540, end: 630 }, [{ start: 600, end: 660, eventId: 'm', title: 'Sync' }]))
      .toEqual([{ start: 600, end: 630, eventId: 'm', title: 'Sync' }]);
    expect(overlapSegments({ start: 540, end: 600 }, [{ start: 600, end: 660, eventId: 'm', title: 'Sync' }])).toEqual([]);
  });

  it('dropLength uses the remaining estimate, capped by the next item and the end of work, on 15-minute steps', () => {
    expect(dropLength(180, 600, 720, 1020)).toBe(120);
    expect(dropLength(null, 600, null, 1020)).toBe(60);
    expect(dropLength(10, 600, null, null)).toBe(15);
    expect(dropLength(200, 1000, null, 1020)).toBe(15);
    expect(dropLength(100, 600, null, null)).toBe(90);
  });

  it('moveAfterSlot finds the first free start after a minute, or null', () => {
    expect(moveAfterSlot(60, 660, [{ start: 660, end: 690 }], { start: 540, end: 1020 })).toBe(690);
    expect(moveAfterSlot(60, 660, [{ start: 690, end: 720 }], { start: 540, end: 1020 })).toBe(720);
    expect(moveAfterSlot(60, 960, [{ start: 960, end: 1020 }], { start: 540, end: 1020 })).toBeNull();
    expect(moveAfterSlot(60, 1400, [], null)).toBeNull();
  });

  it('dayLoad counts overlapping time once', () => {
    expect(dayLoad([{ start: 540, end: 630 }], [{ start: 600, end: 660 }], 420)).toEqual({ plannedMinutes: 120, freeMinutes: 300, over: false });
    expect(dayLoad([{ start: 540, end: 630 }], [{ start: 600, end: 660 }], 100).over).toBe(true);
    expect(dayLoad([{ start: 540, end: 630 }], [], 0)).toEqual({ plannedMinutes: 90, freeMinutes: 0, over: false });
  });

  it('windowMinutes reads the work window as minutes', () => {
    const w: PlannerWorkWindow = {
      workStart: '09:00:00', workEnd: '17:00:00', breakMinutes: 60, breakStart: '12:30:00', isWorkingDay: true, workingMinutes: 420,
    };

    expect(windowMinutes(w)).toEqual({ start: 540, end: 1020, breakStart: 750, breakEnd: 810 });
    expect(windowMinutes({ ...w, breakStart: null, breakMinutes: 0 })).toEqual({ start: 540, end: 1020, breakStart: null, breakEnd: null });
  });
});
