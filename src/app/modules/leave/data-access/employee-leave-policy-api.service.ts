import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeLeavePolicyRow } from '../models/leave-policy.model';

/** Client for /api/v1/employees/{employeeId}/leave-policies. */
@Injectable({ providedIn: 'root' })
export class EmployeeLeavePolicyApiService {
  private readonly http = inject(HttpClient);

  private url(employeeId: string): string {
    return `${environment.apiUrl}/employees/${employeeId}/leave-policies`;
  }

  list(employeeId: string): Observable<readonly EmployeeLeavePolicyRow[]> {
    return this.http.get<readonly EmployeeLeavePolicyRow[]>(this.url(employeeId));
  }

  set(employeeId: string, leaveTypeId: string, policyId: string): Observable<void> {
    return this.http.put<void>(`${this.url(employeeId)}/${leaveTypeId}`, { policyId });
  }

  reset(employeeId: string, leaveTypeId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(employeeId)}/${leaveTypeId}`);
  }
}
