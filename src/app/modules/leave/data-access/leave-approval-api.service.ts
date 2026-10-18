import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  ForwardLeaveRequestRequest,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDetailResponse,
  LeaveApprovalListFilter,
  LeaveRequestAllListFilter,
  LeaveRequestAllListItemResponse,
  RejectLeaveRequestRequest,
  RequestLeaveInformationRequest,
  RespondLeaveInformationRequest
} from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveApprovalsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveApprovalApiService {
  private readonly http = inject(HttpClient);

  listAll(filter: LeaveRequestAllListFilter): Observable<LeaveRequestAllListItemResponse[]> {
    let params = this.toParams(filter);
    if (filter.status) params = params.set('status', filter.status);
    return this.http.get<LeaveRequestAllListItemResponse[]>(`${environment.apiUrl}/leave/requests/all`, { params });
  }

  getDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.http.get<LeaveApprovalDetailResponse>(`${environment.apiUrl}/leave/requests/${requestId}/approval`);
  }

  /** HR's read-only view (leave:read) of any request, used by the All Requests ledger. */
  getLedgerDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.http.get<LeaveApprovalDetailResponse>(`${environment.apiUrl}/leave/requests/${requestId}/detail`);
  }

  approve(requestId: string, payload: ApproveLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/approve`, payload);
  }

  reject(requestId: string, payload: RejectLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/reject`, payload);
  }

  requestInfo(requestId: string, payload: RequestLeaveInformationRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/request-info`, payload);
  }

  forward(requestId: string, payload: ForwardLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/forward`, payload);
  }

  changeDecision(requestId: string, payload: ChangeLeaveDecisionRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/change-decision`, payload);
  }

  respondInfo(requestId: string, payload: RespondLeaveInformationRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/respond-info`, payload);
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.http.post<CancelLeaveRequestResponse>(`${environment.apiUrl}/leave/requests/${requestId}/cancel`, payload);
  }

  private toParams(filter: LeaveApprovalListFilter): HttpParams {
    let params = new HttpParams();
    if (filter.search) params = params.set('search', filter.search);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return params;
  }
}
