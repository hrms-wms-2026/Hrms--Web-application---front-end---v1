import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { EmployeeLeavePolicyRow } from '../models/leave-policy.model';

/** Client for /api/v1/employees/{employeeId}/leave-policies. */
@Injectable({ providedIn: 'root' })
export class EmployeeLeavePolicyApiService {
  private readonly api = inject(ApiClient);

  private path(employeeId: string): string {
    return `/employees/${employeeId}/leave-policies`;
  }

  list(employeeId: string): Observable<readonly EmployeeLeavePolicyRow[]> {
    return this.api.get<readonly EmployeeLeavePolicyRow[]>(this.path(employeeId));
  }

  set(employeeId: string, leaveTypeId: string, policyId: string): Observable<void> {
    return this.api.put<void>(`${this.path(employeeId)}/${leaveTypeId}`, { policyId });
  }

  reset(employeeId: string, leaveTypeId: string): Observable<void> {
    return this.api.delete<void>(`${this.path(employeeId)}/${leaveTypeId}`);
  }
}
