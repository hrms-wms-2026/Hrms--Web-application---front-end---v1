export interface CalendarEventParticipant {
  employeeId: string;
  employeeName: string;
  responseStatus: string;
}

export interface CalendarEventGuest {
  email: string;
}

export interface CalendarEventGuestsResponse {
  guests: readonly CalendarEventGuest[];
}

export interface CalendarEventParticipantsResponse {
  participants: readonly CalendarEventParticipant[];
}

export interface CalendarEventResponse {
  id: string;
  /** "meeting" for a meetings-as-tasks occurrence merged into the calendar (backend Plan C); absent or "event" otherwise. */
  itemKind?: 'event' | 'meeting';
  /** Task meetings only: the series and, once materialized, the occurrence task; open with series + originalStart. */
  meetingSeriesId?: string | null;
  meetingTaskId?: string | null;
  meetingStatus?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | null;
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
  participants: readonly CalendarEventParticipant[] | null;
  hasConflict: boolean;
  isOrganizer?: boolean;
  organizerName?: string | null;
  guests?: readonly CalendarEventGuest[] | null;
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
  location: string | null;
  meetingLink: string | null;
  color: string | null;
  recurrence: string;
  participantEmployeeIds: readonly string[];
  recurrenceRule: string | null;
  guestEmails?: readonly string[];
  /** Set when a Teams/Zoom meeting is about to be attached via a separate createMeeting call right
   * after this one - lets the backend defer the participant/guest invite email until that call
   * succeeds and the join link exists, instead of sending a link-less invite immediately followed
   * by a near-duplicate one with the link. */
  pendingMeetingProvider?: MeetingProvider | null;
}

export interface UpdateCalendarEventRequest {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
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
  location: string | null;
  meetingLink: string | null;
  color: string | null;
}

export type RespondToCalendarEventStatus = 'Accepted' | 'Rejected' | 'ResolutionRequested' | 'ReplacementNominated';

export interface RespondToCalendarEventRequest {
  responseStatus: RespondToCalendarEventStatus;
  reason: string | null;
  nomineeEmployeeId: string | null;
}

export interface EligibleNominee {
  employeeId: string;
  employeeName: string;
}

export interface GetEligibleNomineesResponse {
  nominees: readonly EligibleNominee[];
}

export interface CalendarConflict {
  employeeId: string;
  employeeName: string;
  conflictingEventId: string;
  conflictingEventTitle: string;
  overlapStart: string;
  overlapEnd: string;
}

export interface CheckCalendarConflictsRequest {
  participantEmployeeIds: readonly string[];
  startDate: string;
  endDate: string;
}

export interface CalendarConflictsResponse {
  conflicts: readonly CalendarConflict[];
}

/** Matches backend ONEVO.Domain.Features.Calendar.Entities.CalendarEventMeetingProviders. */
export type MeetingProvider = 'microsoft_teams' | 'zoom';

export type EventMeetingStatus = 'none' | 'active' | 'cancelled' | 'failed' | 'provisioning' | 'provisioning_unknown' | 'unresolved';

export interface EventMeetingStatusResponse {
  status: EventMeetingStatus;
  provider: MeetingProvider | null;
  joinUrl: string | null;
  failureReason: string | null;
}

export interface CreateEventMeetingResponse {
  joinUrl: string;
}

export interface MeetingAttendeeResponse {
  name: string | null;
  email: string | null;
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number | null;
}

export type MeetingAttendanceSyncStatus = 'none' | 'pending' | 'synced' | 'attendance_unavailable' | 'sync_failed';

/** An incident the meeting raised for a participant (organizer view; rule and occurrence only). */
export interface MeetingIncidentResponse {
  employeeName: string;
  rule: string;
  occurrenceStart: string;
  /** Detected from the desktop agent rather than the provider's attendance report. */
  estimated: boolean;
}

export interface MeetingAttendanceResponse {
  available: boolean;
  attendees: readonly MeetingAttendeeResponse[];
  syncStatus?: MeetingAttendanceSyncStatus;
  /** Filled for the organizer only. */
  incidents?: readonly MeetingIncidentResponse[];
}
