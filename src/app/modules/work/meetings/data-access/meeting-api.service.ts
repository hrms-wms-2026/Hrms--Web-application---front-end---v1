import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  CreateMeetingRequest, EditMeetingRequest, EmployeeMeetingAttendanceResponse, MeetingActionItemView, MeetingAttendanceResponse,
  MeetingAttendanceStatusResponse, MeetingAttendeesRequest, MeetingAttendeesResponse, MeetingBulkPreviewRequest,
  MeetingBulkPreviewResponse, MeetingCreatedResponse, MeetingEditResponse, MeetingLinkRequest, MeetingLinkResponse, MeetingListItem,
  MeetingMoveResponse, MeetingOccurrenceResponse, MeetingScope, MeetingSeriesLinkResponse, MeetingSeriesResponse, MoveMeetingRequest,
  RespondToMeetingRequest
} from '../models/meeting.models';

/** Every /api/v1/meetings call (backend docs/api/meetings-v1.md). An occurrence is addressed by series + original start. */
@Injectable({ providedIn: 'root' })
export class MeetingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/meetings`;

  create(request: CreateMeetingRequest): Observable<MeetingCreatedResponse> {
    return this.http.post<MeetingCreatedResponse>(this.baseUrl, request);
  }

  list(from: string, to: string, projectId?: string): Observable<MeetingListItem[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (projectId) params = params.set('projectId', projectId);
    return this.http.get<MeetingListItem[]>(this.baseUrl, { params });
  }

  getOccurrence(taskId: string): Observable<MeetingOccurrenceResponse> {
    return this.http.get<MeetingOccurrenceResponse>(`${this.baseUrl}/occurrences/${taskId}`);
  }

  getOccurrenceAt(seriesId: string, originalStart: string): Observable<MeetingOccurrenceResponse> {
    return this.http.get<MeetingOccurrenceResponse>(this.occurrenceUrl(seriesId, originalStart));
  }

  getSeries(seriesId: string): Observable<MeetingSeriesResponse> {
    return this.http.get<MeetingSeriesResponse>(this.seriesUrl(seriesId));
  }

  edit(seriesId: string, originalStart: string, request: EditMeetingRequest): Observable<MeetingEditResponse> {
    return this.http.patch<MeetingEditResponse>(this.occurrenceUrl(seriesId, originalStart), request);
  }

  cancel(seriesId: string, originalStart: string, scope: MeetingScope): Observable<void> {
    return this.http.post<void>(`${this.occurrenceUrl(seriesId, originalStart)}/cancel`, { scope });
  }

  move(seriesId: string, originalStart: string, request: MoveMeetingRequest): Observable<MeetingMoveResponse> {
    return this.http.post<MeetingMoveResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/move`, request);
  }

  addSeriesAttendees(seriesId: string, request: MeetingAttendeesRequest): Observable<MeetingAttendeesResponse> {
    return this.http.post<MeetingAttendeesResponse>(`${this.seriesUrl(seriesId)}/attendees`, request);
  }

  removeSeriesEmployee(seriesId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.seriesUrl(seriesId)}/attendees/employees/${employeeId}`);
  }

  removeSeriesGuest(seriesId: string, email: string): Observable<void> {
    return this.http.delete<void>(`${this.seriesUrl(seriesId)}/attendees/guests/${encodeURIComponent(email)}`);
  }

  addOccurrenceAttendees(seriesId: string, originalStart: string, request: MeetingAttendeesRequest): Observable<MeetingAttendeesResponse> {
    return this.http.post<MeetingAttendeesResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees`, request);
  }

  removeOccurrenceEmployee(seriesId: string, originalStart: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees/employees/${employeeId}`);
  }

  removeOccurrenceGuest(seriesId: string, originalStart: string, email: string): Observable<void> {
    return this.http.delete<void>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees/guests/${encodeURIComponent(email)}`);
  }

  respond(seriesId: string, request: RespondToMeetingRequest): Observable<void> {
    return this.http.post<void>(`${this.seriesUrl(seriesId)}/respond`, request);
  }

  getLink(seriesId: string): Observable<MeetingSeriesLinkResponse> {
    return this.http.get<MeetingSeriesLinkResponse>(`${this.seriesUrl(seriesId)}/link`);
  }

  createLink(seriesId: string, request: MeetingLinkRequest): Observable<MeetingLinkResponse> {
    return this.http.post<MeetingLinkResponse>(`${this.seriesUrl(seriesId)}/link`, request);
  }

  retryLink(seriesId: string): Observable<MeetingLinkResponse> {
    return this.http.post<MeetingLinkResponse>(`${this.seriesUrl(seriesId)}/link/retry`, {});
  }

  /** 200 with the link's new state, or 204 (null) when there was no link. */
  removeLink(seriesId: string): Observable<MeetingLinkResponse | null> {
    return this.http.delete<MeetingLinkResponse | null>(`${this.seriesUrl(seriesId)}/link`).pipe(map((r) => r ?? null));
  }

  confirmLinkCleanup(seriesId: string): Observable<void> {
    return this.http.post<void>(`${this.seriesUrl(seriesId)}/link/cleanup-confirmed`, {});
  }

  getAttendance(seriesId: string, originalStart: string): Observable<MeetingAttendanceResponse> {
    return this.http.get<MeetingAttendanceResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendance`);
  }

  recheckAttendance(seriesId: string, originalStart: string): Observable<MeetingAttendanceStatusResponse> {
    return this.http.post<MeetingAttendanceStatusResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendance/recheck`, {});
  }

  listActionItems(occurrenceTaskId: string): Observable<MeetingActionItemView[]> {
    return this.http.get<MeetingActionItemView[]>(`${this.baseUrl}/occurrences/${occurrenceTaskId}/action-items`);
  }

  unlinkActionItem(occurrenceTaskId: string, actionTaskId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/occurrences/${occurrenceTaskId}/action-items/${actionTaskId}`);
  }

  bulkPreview(request: MeetingBulkPreviewRequest): Observable<MeetingBulkPreviewResponse> {
    return this.http.post<MeetingBulkPreviewResponse>(`${this.baseUrl}/bulk-preview`, request);
  }

  employeeMeetingAttendance(employeeId: string, from?: string, to?: string): Observable<EmployeeMeetingAttendanceResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<EmployeeMeetingAttendanceResponse>(`${environment.apiUrl}/employees/${employeeId}/meeting-attendance`, { params });
  }

  private seriesUrl(seriesId: string): string {
    return `${this.baseUrl}/series/${seriesId}`;
  }

  /** The occurrence key always travels as the UTC instant, URL-encoded. */
  private occurrenceUrl(seriesId: string, originalStart: string): string {
    return `${this.seriesUrl(seriesId)}/occurrences/${encodeURIComponent(new Date(originalStart).toISOString())}`;
  }
}
