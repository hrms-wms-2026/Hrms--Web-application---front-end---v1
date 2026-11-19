import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

/** Client for ONEVO.Api's LeaveTypesController at /api/v1/leave/types. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    return this.api.get<LeaveTypeResponse[]>('/leave/types', { params: { includeInactive } });
  }

  get(leaveTypeId: string): Observable<LeaveTypeResponse> {
    return this.api.get<LeaveTypeResponse>(`/leave/types/${leaveTypeId}`);
  }

  create(payload: CreateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.api.post<LeaveTypeResponse>('/leave/types', payload);
  }

  update(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.api.put<LeaveTypeResponse>(`/leave/types/${leaveTypeId}`, payload);
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    return this.api.post<void>(`/leave/types/${leaveTypeId}/deactivate`, {}, { params: { confirmed } });
  }
}
