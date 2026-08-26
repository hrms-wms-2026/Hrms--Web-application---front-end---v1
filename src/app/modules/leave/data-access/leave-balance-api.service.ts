import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter } from '../models/leave-balance.model';

/** Client for ONEVO.Api's LeaveBalancesController at /api/v1/leave/balances. */
@Injectable({ providedIn: 'root' })
export class LeaveBalanceApiService {
  private readonly http = inject(HttpClient);
  my(year: number): Observable<LeaveBalanceResponse[]> { return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/my`, { params: new HttpParams().set('year', year) }); }
  team(year: number, filter: LeaveBalanceTeamFilter): Observable<LeaveBalanceResponse[]> { let params = new HttpParams().set('year', year); if (filter.departmentId) params = params.set('departmentId', filter.departmentId); if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId); if (filter.search) params = params.set('search', filter.search); return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/team`, { params }); }
  all(year: number, filter: LeaveBalanceAllFilter): Observable<LeaveBalanceResponse[]> { let params = new HttpParams().set('year', year); if (filter.legalEntityId) params = params.set('legalEntityId', filter.legalEntityId); if (filter.departmentId) params = params.set('departmentId', filter.departmentId); if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId); if (filter.employmentStatusId !== undefined) params = params.set('employmentStatusId', filter.employmentStatusId); if (filter.search) params = params.set('search', filter.search); return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/all`, { params }); }
}
