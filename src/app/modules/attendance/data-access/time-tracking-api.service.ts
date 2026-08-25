import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AttendanceCorrectionApprovalListItem,
  AttendanceCorrectionListItem,
  AttendanceCorrectionPreviewRequest,
  AttendanceCorrectionPreviewResponse,
  AttendanceCorrectionRequest,
  AttendanceCorrectionResponse,
  ApproveAttendanceCorrectionRequest,
  RejectAttendanceCorrectionRequest
} from '../models/attendance-correction.model';
import {
  AttendanceHistoryRow,
  AttendanceTodayResponse,
  ClockInRequest,
  PagedResultDto
} from '../models/time-tracking.model';

@Injectable({ providedIn: 'root' })
export class TimeTrackingApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking`;
  private readonly correctionsPath = `${environment.apiUrl}/attendance/corrections`;

  getToday(): Observable<AttendanceTodayResponse> {
    return this.http.get<AttendanceTodayResponse>(`${this.basePath}/today`);
  }

  getMyHistory(from: string, to: string, page: number, pageSize: number): Observable<PagedResultDto<AttendanceHistoryRow>> {
    return this.http.get<PagedResultDto<AttendanceHistoryRow>>(`${this.basePath}/history`, {
      params: this.withPaging(this.rangeParams(from, to), page, pageSize)
    });
  }

  getCoveredHistory(
    from: string,
    to: string,
    page: number,
    pageSize: number,
    employeeId?: string
  ): Observable<PagedResultDto<AttendanceHistoryRow>> {
    let params = this.withPaging(this.rangeParams(from, to), page, pageSize);
    if (employeeId) {
      params = params.set('employeeId', employeeId);
    }

    return this.http.get<PagedResultDto<AttendanceHistoryRow>>(`${this.basePath}/covered-history`, {
      params
    });
  }

  clockIn(): Observable<AttendanceTodayResponse> {
    const request: ClockInRequest = { source: 'web' };
    return this.http.post<AttendanceTodayResponse>(`${this.basePath}/clock-in`, request);
  }

  startBreak(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/break/start`);
  }

  endBreak(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/break/end`);
  }

  clockOut(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/clock-out`);
  }

  previewCorrection(request: AttendanceCorrectionPreviewRequest): Observable<AttendanceCorrectionPreviewResponse> {
    return this.http.post<AttendanceCorrectionPreviewResponse>(`${this.correctionsPath}/preview`, request);
  }

  submitCorrection(request: AttendanceCorrectionRequest): Observable<AttendanceCorrectionResponse> {
    return this.http.post<AttendanceCorrectionResponse>(this.correctionsPath, request);
  }

  getMyCorrections(page: number, pageSize: number, from?: string, to?: string): Observable<PagedResultDto<AttendanceCorrectionListItem>> {
    return this.http.get<PagedResultDto<AttendanceCorrectionListItem>>(`${this.correctionsPath}/my`, {
      params: this.withPaging(this.optionalCorrectionParams(from, to), page, pageSize)
    });
  }

  getApprovalInbox(status = 'pending'): Observable<readonly AttendanceCorrectionApprovalListItem[]> {
    return this.http.get<readonly AttendanceCorrectionApprovalListItem[]>(`${this.correctionsPath}/approvals`, {
      params: new HttpParams().set('status', status)
    });
  }

  approveCorrection(id: string, request: ApproveAttendanceCorrectionRequest): Observable<AttendanceCorrectionResponse> {
    return this.http.post<AttendanceCorrectionResponse>(`${this.correctionsPath}/${id}/approve`, request);
  }

  rejectCorrection(id: string, request: RejectAttendanceCorrectionRequest): Observable<AttendanceCorrectionResponse> {
    return this.http.post<AttendanceCorrectionResponse>(`${this.correctionsPath}/${id}/reject`, request);
  }

  cancelCorrection(id: string): Observable<AttendanceCorrectionResponse> {
    return this.http.post<AttendanceCorrectionResponse>(`${this.correctionsPath}/${id}/cancel`, null);
  }

  private rangeParams(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }

  private withPaging(params: HttpParams, page: number, pageSize: number): HttpParams {
    return params.set('pageNumber', page).set('pageSize', pageSize);
  }

  private optionalCorrectionParams(from?: string, to?: string): HttpParams {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }

  /** HttpClient requires the body argument; null produces an empty POST body. */
  private postWithoutBody(url: string): Observable<AttendanceTodayResponse> {
    return this.http.post<AttendanceTodayResponse>(url, null);
  }
}
