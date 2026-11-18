import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  CancelLeaveRequestRequest,
  CancelLeaveRequestResponse,
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  LeaveUploadedDocument,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveRequestsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveRequestApiService {
  private readonly api = inject(ApiClient);

  uploadDocument(file: File): Observable<LeaveUploadedDocument> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.post<LeaveUploadedDocument>('/leave/requests/documents', form);
  }

  preview(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests/preview', payload);
  }

  submit(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests', payload);
  }

  submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests/on-behalf', payload);
  }

  listMine(filter: LeaveRequestListFilter): Observable<LeaveRequestListItemResponse[]> {
    return this.api.get<LeaveRequestListItemResponse[]>('/leave/requests/my', {
      params: { status: filter.status, fromDate: filter.fromDate, toDate: filter.toDate, leaveTypeId: filter.leaveTypeId }
    });
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.api.post<CancelLeaveRequestResponse>(`/leave/requests/${requestId}/cancel`, payload);
  }
}
