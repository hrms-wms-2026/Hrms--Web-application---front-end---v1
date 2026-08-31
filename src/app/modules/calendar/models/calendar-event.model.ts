export interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  sourceType: string;
  color: string | null;
  recurrence: string;
  isAllDay: boolean;
  timezone: string | null;
  eventStatus: string | null;
  isPrivate: boolean;
  location: string | null;
  meetingLink: string | null;
  externalSource: string | null;
  createdById: string;
  isRecurringOccurrence: boolean;
  recurrenceMasterId: string | null;
  originalStart: string | null;
}

export interface CalendarEventsResponse {
  events: readonly CalendarEventResponse[];
}

export interface CreateCalendarEventRequest {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
  recurrence: string;
  participantEmployeeIds: readonly string[];
  recurrenceRule: string | null;
}

export interface UpdateCalendarEventRequest {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
  recurrence: string;
}

export type RecurrenceEditScope = 'ThisEventOnly' | 'AllEvents';

export interface EditRecurringOccurrenceRequest {
  originalStart: string;
  scope: RecurrenceEditScope;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
}
