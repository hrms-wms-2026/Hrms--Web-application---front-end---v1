import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApproveLeaveRequestRequest,
  BulkApproveLeaveRequestsRequest,
  BulkRejectLeaveRequestsRequest,
  ChangeLeaveDecisionRequest,
  CreateLeaveApprovalDelegateRequest,
  ForwardLeaveRequestRequest,
  LeaveApprovalBulkResultResponse,
  LeaveApprovalDelegateResponse,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDetailResponse,
  LeaveApprovalHistoryFilter,
  LeaveApprovalHistoryItemResponse,
  LeaveApprovalListFilter,
  LeavePendingApprovalListItemResponse,
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

  listPending(filter: LeaveApprovalListFilter): Observable<LeavePendingApprovalListItemResponse[]> {
    return this.http.get<LeavePendingApprovalListItemResponse[]>(
      `${environment.apiUrl}/leave/requests/pending-approvals`, { params: this.toParams(filter) });
  }

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

  listHistory(filter: LeaveApprovalHistoryFilter): Observable<LeaveApprovalHistoryItemResponse[]> {
    let params = new HttpParams();
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get<LeaveApprovalHistoryItemResponse[]>(`${environment.apiUrl}/leave/requests/approval-history`, { params });
  }

  respondInfo(requestId: string, payload: RespondLeaveInformationRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.http.post<LeaveApprovalDecisionResponse>(`${environment.apiUrl}/leave/requests/${requestId}/respond-info`, payload);
  }

  bulkApprove(payload: BulkApproveLeaveRequestsRequest): Observable<LeaveApprovalBulkResultResponse> {
    return this.http.post<LeaveApprovalBulkResultResponse>(`${environment.apiUrl}/leave/requests/bulk-approve`, payload);
  }

  bulkReject(payload: BulkRejectLeaveRequestsRequest): Observable<LeaveApprovalBulkResultResponse> {
    return this.http.post<LeaveApprovalBulkResultResponse>(`${environment.apiUrl}/leave/requests/bulk-reject`, payload);
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.http.post<CancelLeaveRequestResponse>(`${environment.apiUrl}/leave/requests/${requestId}/cancel`, payload);
  }

  listDelegates(): Observable<LeaveApprovalDelegateResponse[]> {
    return this.http.get<LeaveApprovalDelegateResponse[]>(`${environment.apiUrl}/leave/approval-delegates`);
  }

  createDelegate(payload: CreateLeaveApprovalDelegateRequest): Observable<LeaveApprovalDelegateResponse> {
    return this.http.post<LeaveApprovalDelegateResponse>(`${environment.apiUrl}/leave/approval-delegates`, payload);
  }

  deleteDelegate(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/leave/approval-delegates/${id}`);
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
