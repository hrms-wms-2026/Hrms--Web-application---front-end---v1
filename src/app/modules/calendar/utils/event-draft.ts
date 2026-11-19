import { localPartsToUtcIso } from '../../../shared/utils/timezone.util';
import { CreateCalendarEventRequest } from '../models/calendar-event.model';
import { RecurrenceFrequency, buildRecurrenceRule } from './recurrence-rule.util';

/**
 * A personal event as the Planner create popover holds it: wall-clock `start`/`end` ("YYYY-MM-DDTHH:mm") in `timezone`.
 */
export interface EventDraft {
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  timezone: string;
  repeat: RecurrenceFrequency;
  location: string | null;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * The stored instants of an event. All day runs from local midnight of the first day to local midnight after the last
 * day (exclusive), the convention synced Google/Outlook all-day events use.
 */
export function eventInstants(start: string, end: string, isAllDay: boolean, timezone: string): { startDate: string; endDate: string } {
  const [startDay, startTime] = start.split('T');
  const [endDay, endTime] = end.split('T');
  return {
    startDate: localPartsToUtcIso(startDay, isAllDay ? '00:00' : startTime, timezone),
    endDate: localPartsToUtcIso(isAllDay ? nextDay(endDay) : endDay, isAllDay ? '00:00' : endTime, timezone),
  };
}

/** A personal event: no people, link or colour (those make it a meeting, or live in the full form). */
export function eventCreateRequest(draft: EventDraft): CreateCalendarEventRequest {
  const { startDate, endDate } = eventInstants(draft.start, draft.end, draft.isAllDay, draft.timezone);
  return {
    title: draft.title.trim(), description: draft.description || null, startDate, endDate,
    isAllDay: draft.isAllDay, location: draft.location || null, meetingLink: null, color: null, recurrence: draft.repeat,
    participantEmployeeIds: [], recurrenceRule: buildRecurrenceRule(draft.repeat, 'never', null), guestEmails: [],
    pendingMeetingProvider: null,
  };
}
