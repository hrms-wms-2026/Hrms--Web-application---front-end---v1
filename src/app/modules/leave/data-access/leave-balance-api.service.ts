import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter, LeaveWorkWindowResponse } from '../models/leave-balance.model';

/** Client for ONEVO.Api's LeaveBalancesController at /api/v1/leave/balances. */
@Injectable({ providedIn: 'root' })
export class LeaveBalanceApiService {
  private readonly api = inject(ApiClient);

  my(year: number): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/my', { params: { year } });
  }

  team(year: number, filter: LeaveBalanceTeamFilter): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/team', {
      params: { year, departmentId: filter.departmentId, leaveTypeId: filter.leaveTypeId, search: filter.search }
    });
  }

  all(year: number, filter: LeaveBalanceAllFilter): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/all', {
      params: {
        year,
        legalEntityId: filter.legalEntityId,
        departmentId: filter.departmentId,
        leaveTypeId: filter.leaveTypeId,
        employmentStatusId: filter.employmentStatusId,
        search: filter.search
      }
    });
  }

  workWindow(): Observable<LeaveWorkWindowResponse> {
    return this.api.get<LeaveWorkWindowResponse>('/leave/balances/work-window');
  }
}
