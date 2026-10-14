import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CalendarConflictsResponse, CalendarEventGuestsResponse, CalendarEventParticipantsResponse, CalendarEventResponse, CalendarEventsResponse,
  CheckCalendarConflictsRequest, CreateCalendarEventRequest, CreateEventMeetingResponse,
  EditRecurringOccurrenceRequest, EventMeetingStatusResponse, GetEligibleNomineesResponse, MeetingAttendanceResponse, MeetingProvider,
  RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../models/calendar-event.model';

@Injectable({ providedIn: 'root' })
export class CalendarEventApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/calendar`;

  getEvents(from: string, to: string): Observable<CalendarEventsResponse> {
    return this.http.get<CalendarEventsResponse>(this.baseUrl, { params: { from, to } });
  }

  create(payload: CreateCalendarEventRequest): Observable<CalendarEventResponse> {
    return this.http.post<CalendarEventResponse>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCalendarEventRequest): Observable<CalendarEventResponse> {
    return this.http.put<CalendarEventResponse>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  editOccurrence(masterId: string, payload: EditRecurringOccurrenceRequest): Observable<CalendarEventResponse> {
    return this.http.put<CalendarEventResponse>(`${this.baseUrl}/${masterId}/occurrence`, payload);
  }

  cancelOccurrence(masterId: string, originalStart: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${masterId}/occurrence`, { params: { originalStart } });
  }

  respond(
    eventId: string, responseStatus: RespondToCalendarEventStatus,
    reason: string | null = null, nomineeEmployeeId: string | null = null
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${eventId}/respond`, { responseStatus, reason, nomineeEmployeeId });
  }

  getEligibleNominees(eventId: string): Observable<GetEligibleNomineesResponse> {
    return this.http.get<GetEligibleNomineesResponse>(`${this.baseUrl}/${eventId}/eligible-nominees`);
  }

  checkConflicts(payload: CheckCalendarConflictsRequest): Observable<CalendarConflictsResponse> {
    return this.http.post<CalendarConflictsResponse>(`${this.baseUrl}/check-conflicts`, payload);
  }

  getMyTimezone(): Observable<{ timezone: string }> {
    return this.http.get<{ timezone: string }>(`${this.baseUrl}/my-timezone`);
  }

  createMeeting(eventId: string, provider: MeetingProvider): Observable<CreateEventMeetingResponse> {
    return this.http.post<CreateEventMeetingResponse>(`${this.baseUrl}/${eventId}/meeting`, { provider });
  }

  removeMeeting(eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${eventId}/meeting`);
  }

  getMeeting(eventId: string): Observable<EventMeetingStatusResponse> {
    return this.http.get<EventMeetingStatusResponse>(`${this.baseUrl}/${eventId}/meeting`);
  }

  retryMeeting(eventId: string): Observable<CreateEventMeetingResponse> {
    return this.http.post<CreateEventMeetingResponse>(`${this.baseUrl}/${eventId}/meeting/retry`, {});
  }

  confirmMeetingCleanup(eventId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${eventId}/meeting/confirm-cleanup`, {});
  }

  getMeetingAttendance(eventId: string): Observable<MeetingAttendanceResponse> {
    return this.http.get<MeetingAttendanceResponse>(`${this.baseUrl}/${eventId}/meeting/attendance`);
  }

  addParticipants(eventId: string, employeeIds: readonly string[]): Observable<CalendarEventParticipantsResponse> {
    return this.http.post<CalendarEventParticipantsResponse>(`${this.baseUrl}/${eventId}/participants`, { employeeIds });
  }

  removeParticipant(eventId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${eventId}/participants/${employeeId}`);
  }

  addGuests(eventId: string, emails: readonly string[]): Observable<CalendarEventGuestsResponse> {
    return this.http.post<CalendarEventGuestsResponse>(`${this.baseUrl}/${eventId}/guests`, { emails });
  }

  removeGuest(eventId: string, email: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${eventId}/guests`, { params: { email } });
  }
}
