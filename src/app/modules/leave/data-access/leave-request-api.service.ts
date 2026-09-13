import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CancelLeaveRequestRequest,
  CancelLeaveRequestResponse,
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveRequestsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveRequestApiService {
  private readonly http = inject(HttpClient);

  preview(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests/preview`, payload);
  }

  submit(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests`, payload);
  }

  submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests/on-behalf`, payload);
  }

  listMine(filter: LeaveRequestListFilter): Observable<LeaveRequestListItemResponse[]> {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    return this.http.get<LeaveRequestListItemResponse[]>(`${environment.apiUrl}/leave/requests/my`, { params });
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.http.post<CancelLeaveRequestResponse>(`${environment.apiUrl}/leave/requests/${requestId}/cancel`, payload);
  }
}
