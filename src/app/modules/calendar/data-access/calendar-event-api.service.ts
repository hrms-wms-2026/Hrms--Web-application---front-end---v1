import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CalendarConflictsResponse, CalendarEventResponse, CalendarEventsResponse, CheckCalendarConflictsRequest,
  CreateCalendarEventRequest, EditRecurringOccurrenceRequest, GetEligibleNomineesResponse,
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
}
