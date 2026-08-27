import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateLeaveTypeRequest,
  LeaveTypeResponse,
  UpdateLeaveTypeRequest
} from '../models/leave-type.model';

/** Client for ONEVO.Api's LeaveTypesController at /api/v1/leave/types. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly http = inject(HttpClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<LeaveTypeResponse[]>(`${environment.apiUrl}/leave/types`, { params });
  }

  get(leaveTypeId: string): Observable<LeaveTypeResponse> {
    return this.http.get<LeaveTypeResponse>(`${environment.apiUrl}/leave/types/${leaveTypeId}`);
  }

  create(payload: CreateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.http.post<LeaveTypeResponse>(`${environment.apiUrl}/leave/types`, payload);
  }

  update(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.http.put<LeaveTypeResponse>(`${environment.apiUrl}/leave/types/${leaveTypeId}`, payload);
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    const params = new HttpParams().set('confirmed', confirmed);
    return this.http.post<void>(`${environment.apiUrl}/leave/types/${leaveTypeId}/deactivate`, {}, { params });
  }
}
