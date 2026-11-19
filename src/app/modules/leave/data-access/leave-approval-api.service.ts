import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDetailResponse,
  LeaveApprovalListFilter,
  LeavePendingApprovalListItemResponse,
  LeaveRequestAllListFilter,
  LeaveRequestAllListItemResponse,
  RejectLeaveRequestRequest
} from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveApprovalsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveApprovalApiService {
  private readonly api = inject(ApiClient);

  listAll(filter: LeaveRequestAllListFilter): Observable<LeaveRequestAllListItemResponse[]> {
    return this.api.get<LeaveRequestAllListItemResponse[]>('/leave/requests/all', {
      params: { ...listParams(filter), status: filter.status }
    });
  }

  /** Requests waiting on the caller's decision (leave:approve). */
  listPendingApprovals(): Observable<LeavePendingApprovalListItemResponse[]> {
    return this.api.get<LeavePendingApprovalListItemResponse[]>('/leave/requests/pending-approvals');
  }

  getDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.api.get<LeaveApprovalDetailResponse>(`/leave/requests/${requestId}/approval`);
  }

  /** HR's read-only view (leave:read) of any request, used by the All Requests ledger. */
  getLedgerDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.api.get<LeaveApprovalDetailResponse>(`/leave/requests/${requestId}/detail`);
  }

  approve(requestId: string, payload: ApproveLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/approve`, payload);
  }

  reject(requestId: string, payload: RejectLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/reject`, payload);
  }

  changeDecision(requestId: string, payload: ChangeLeaveDecisionRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/change-decision`, payload);
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.api.post<CancelLeaveRequestResponse>(`/leave/requests/${requestId}/cancel`, payload);
  }
}

/** Key order here is the query-string order the backend and specs expect. */
function listParams(filter: LeaveApprovalListFilter): object {
  return { search: filter.search, leaveTypeId: filter.leaveTypeId, fromDate: filter.fromDate, toDate: filter.toDate };
}
