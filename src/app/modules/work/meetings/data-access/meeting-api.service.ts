import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../core/interceptors/error.interceptor';
import {
  CreateMeetingRequest, EditMeetingRequest, EmployeeMeetingAttendanceResponse, MeetingActionItemView, MeetingAttendanceResponse,
  MeetingAttendanceStatusResponse, MeetingAttendeesRequest, MeetingAttendeesResponse, MeetingBulkPreviewRequest,
  MeetingBulkPreviewResponse, MeetingCreatedResponse, MeetingEditResponse, MeetingLinkRequest, MeetingLinkResponse, MeetingListItem,
  MeetingMoveResponse, MeetingOccurrenceResponse, MeetingScope, MeetingSeriesLinkResponse, MeetingSeriesResponse, MoveMeetingRequest,
  RespondToMeetingRequest
} from '../models/meeting.models';
import { MeetingsAvailabilityService } from '../state/meetings-availability.service';

/**
 * Every /api/v1/meetings call (backend docs/api/meetings-v1.md). An occurrence is addressed by series + original start.
 * Every write's caller shows its own error copy, so writes skip the global error toast; a refused write also tells
 * MeetingsAvailabilityService when meetings are off or read-only.
 */
@Injectable({ providedIn: 'root' })
export class MeetingApiService {
  private readonly http = inject(HttpClient);
  private readonly availability = inject(MeetingsAvailabilityService);
  private readonly baseUrl = `${environment.apiUrl}/meetings`;
  private readonly silent = { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) };

  create(request: CreateMeetingRequest): Observable<MeetingCreatedResponse> {
    return this.watched(this.http.post<MeetingCreatedResponse>(this.baseUrl, request, this.silent));
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
    return this.watched(this.http.patch<MeetingEditResponse>(this.occurrenceUrl(seriesId, originalStart), request, this.silent));
  }

  cancel(seriesId: string, originalStart: string, scope: MeetingScope): Observable<void> {
    return this.watched(this.http.post<void>(`${this.occurrenceUrl(seriesId, originalStart)}/cancel`, { scope }, this.silent));
  }

  move(seriesId: string, originalStart: string, request: MoveMeetingRequest): Observable<MeetingMoveResponse> {
    return this.watched(this.http.post<MeetingMoveResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/move`, request, this.silent));
  }

  addSeriesAttendees(seriesId: string, request: MeetingAttendeesRequest): Observable<MeetingAttendeesResponse> {
    return this.watched(this.http.post<MeetingAttendeesResponse>(`${this.seriesUrl(seriesId)}/attendees`, request, this.silent));
  }

  removeSeriesEmployee(seriesId: string, employeeId: string): Observable<void> {
    return this.watched(this.http.delete<void>(`${this.seriesUrl(seriesId)}/attendees/employees/${employeeId}`, this.silent));
  }

  removeSeriesGuest(seriesId: string, email: string): Observable<void> {
    return this.watched(this.http.delete<void>(`${this.seriesUrl(seriesId)}/attendees/guests/${encodeURIComponent(email)}`, this.silent));
  }

  addOccurrenceAttendees(seriesId: string, originalStart: string, request: MeetingAttendeesRequest): Observable<MeetingAttendeesResponse> {
    return this.watched(this.http.post<MeetingAttendeesResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees`, request, this.silent));
  }

  removeOccurrenceEmployee(seriesId: string, originalStart: string, employeeId: string): Observable<void> {
    return this.watched(this.http.delete<void>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees/employees/${employeeId}`, this.silent));
  }

  removeOccurrenceGuest(seriesId: string, originalStart: string, email: string): Observable<void> {
    return this.watched(this.http.delete<void>(`${this.occurrenceUrl(seriesId, originalStart)}/attendees/guests/${encodeURIComponent(email)}`, this.silent));
  }

  respond(seriesId: string, request: RespondToMeetingRequest): Observable<void> {
    return this.watched(this.http.post<void>(`${this.seriesUrl(seriesId)}/respond`, request, this.silent));
  }

  getLink(seriesId: string): Observable<MeetingSeriesLinkResponse> {
    return this.http.get<MeetingSeriesLinkResponse>(`${this.seriesUrl(seriesId)}/link`);
  }

  createLink(seriesId: string, request: MeetingLinkRequest): Observable<MeetingLinkResponse> {
    return this.watched(this.http.post<MeetingLinkResponse>(`${this.seriesUrl(seriesId)}/link`, request, this.silent));
  }

  retryLink(seriesId: string): Observable<MeetingLinkResponse> {
    return this.watched(this.http.post<MeetingLinkResponse>(`${this.seriesUrl(seriesId)}/link/retry`, {}, this.silent));
  }

  /** 200 with the link's new state, or 204 (null) when there was no link. */
  removeLink(seriesId: string): Observable<MeetingLinkResponse | null> {
    return this.watched(this.http.delete<MeetingLinkResponse | null>(`${this.seriesUrl(seriesId)}/link`, this.silent)).pipe(map((r) => r ?? null));
  }

  confirmLinkCleanup(seriesId: string): Observable<void> {
    return this.watched(this.http.post<void>(`${this.seriesUrl(seriesId)}/link/cleanup-confirmed`, {}, this.silent));
  }

  getAttendance(seriesId: string, originalStart: string): Observable<MeetingAttendanceResponse> {
    return this.http.get<MeetingAttendanceResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendance`);
  }

  recheckAttendance(seriesId: string, originalStart: string): Observable<MeetingAttendanceStatusResponse> {
    return this.watched(this.http.post<MeetingAttendanceStatusResponse>(`${this.occurrenceUrl(seriesId, originalStart)}/attendance/recheck`, {}, this.silent));
  }

  listActionItems(occurrenceTaskId: string): Observable<MeetingActionItemView[]> {
    return this.http.get<MeetingActionItemView[]>(`${this.baseUrl}/occurrences/${occurrenceTaskId}/action-items`);
  }

  unlinkActionItem(occurrenceTaskId: string, actionTaskId: string): Observable<void> {
    return this.watched(this.http.delete<void>(`${this.baseUrl}/occurrences/${occurrenceTaskId}/action-items/${actionTaskId}`, this.silent));
  }

  bulkPreview(request: MeetingBulkPreviewRequest): Observable<MeetingBulkPreviewResponse> {
    return this.watched(this.http.post<MeetingBulkPreviewResponse>(`${this.baseUrl}/bulk-preview`, request, this.silent));
  }

  employeeMeetingAttendance(employeeId: string, from?: string, to?: string): Observable<EmployeeMeetingAttendanceResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<EmployeeMeetingAttendanceResponse>(`${environment.apiUrl}/employees/${employeeId}/meeting-attendance`, { params });
  }

  private watched<T>(request: Observable<T>): Observable<T> {
    return request.pipe(tap({ error: (e: unknown) => this.availability.noteError(e) }));
  }

  private seriesUrl(seriesId: string): string {
    return `${this.baseUrl}/series/${seriesId}`;
  }

  /** The occurrence key always travels as the UTC instant, URL-encoded. */
  private occurrenceUrl(seriesId: string, originalStart: string): string {
    return `${this.seriesUrl(seriesId)}/occurrences/${encodeURIComponent(new Date(originalStart).toISOString())}`;
  }
}
