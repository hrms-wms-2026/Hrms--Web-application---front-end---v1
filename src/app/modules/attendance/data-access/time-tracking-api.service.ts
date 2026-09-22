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
  AttendanceDayDetail,
  AttendanceHistoryRow,
  AttendanceMonthlySummaryResponse,
  AttendanceTodayResponse,
  ClockInRequest,
  EmployeeDailyReport,
  PagedResultDto
} from '../models/time-tracking.model';
import {
  ReviewWorkAreaChangeRequestPayload,
  WorkAreaChangeRequestPayload,
  WorkAreaChangeRequestPreviewResponse,
  WorkAreaChangeRequestQuery,
  WorkAreaChangeRequestResponse
} from '../models/work-area-change-request.model';

@Injectable({ providedIn: 'root' })
export class TimeTrackingApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking`;
  private readonly correctionsPath = `${environment.apiUrl}/attendance/corrections`;
  private readonly workAreaChangeRequestsPath = `${environment.apiUrl}/attendance/work-area-change-requests`;

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

  getMyMonthlySummary(from: string, to: string): Observable<AttendanceMonthlySummaryResponse> {
    return this.http.get<AttendanceMonthlySummaryResponse>(`${this.basePath}/monthly-summary`, {
      params: this.rangeParams(from, to)
    });
  }

  getDayDetail(employeeId: string, date: string): Observable<AttendanceDayDetail> {
    const params = new HttpParams().set('employeeId', employeeId).set('date', date);
    return this.http.get<AttendanceDayDetail>(`${this.basePath}/history-detail`, { params });
  }

  /** MonitoringDailyReportController GET /api/v1/monitoring/daily-report. Requires monitoring:read. */
  getEmployeeDailyReport(employeeId: string, date: string): Observable<EmployeeDailyReport> {
    const params = new HttpParams().set('employeeId', employeeId).set('date', date);
    return this.http.get<EmployeeDailyReport>(`${environment.apiUrl}/monitoring/daily-report`, { params });
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

  previewWorkAreaChange(payload: WorkAreaChangeRequestPayload): Observable<WorkAreaChangeRequestPreviewResponse> {
    return this.http.post<WorkAreaChangeRequestPreviewResponse>(`${this.workAreaChangeRequestsPath}/preview`, payload);
  }

  createWorkAreaChangeRequest(payload: WorkAreaChangeRequestPayload): Observable<WorkAreaChangeRequestResponse> {
    return this.http.post<WorkAreaChangeRequestResponse>(this.workAreaChangeRequestsPath, payload);
  }

  getMyWorkAreaChangeRequests(query: WorkAreaChangeRequestQuery): Observable<PagedResultDto<WorkAreaChangeRequestResponse>> {
    return this.http.get<PagedResultDto<WorkAreaChangeRequestResponse>>(`${this.workAreaChangeRequestsPath}/my`, {
      params: this.workAreaQueryParams(query)
    });
  }

  getWorkAreaChangeApprovalInbox(query: WorkAreaChangeRequestQuery): Observable<PagedResultDto<WorkAreaChangeRequestResponse>> {
    return this.http.get<PagedResultDto<WorkAreaChangeRequestResponse>>(`${this.workAreaChangeRequestsPath}/approvals`, {
      params: this.workAreaQueryParams(query)
    });
  }

  approveWorkAreaChangeRequest(id: string, reviewComment?: string | null): Observable<WorkAreaChangeRequestResponse> {
    return this.http.post<WorkAreaChangeRequestResponse>(`${this.workAreaChangeRequestsPath}/${id}/approve`, {
      reviewComment: reviewComment ?? null
    } satisfies ReviewWorkAreaChangeRequestPayload);
  }

  rejectWorkAreaChangeRequest(id: string, reviewComment: string): Observable<WorkAreaChangeRequestResponse> {
    return this.http.post<WorkAreaChangeRequestResponse>(`${this.workAreaChangeRequestsPath}/${id}/reject`, {
      reviewComment
    } satisfies ReviewWorkAreaChangeRequestPayload);
  }

  cancelWorkAreaChangeRequest(id: string): Observable<WorkAreaChangeRequestResponse> {
    return this.http.post<WorkAreaChangeRequestResponse>(`${this.workAreaChangeRequestsPath}/${id}/cancel`, null);
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

  private workAreaQueryParams(query: WorkAreaChangeRequestQuery): HttpParams {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber)
      .set('pageSize', query.pageSize);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.status) params = params.set('status', query.status);
    return params;
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
