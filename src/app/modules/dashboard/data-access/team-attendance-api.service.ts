import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  TeamAttendanceEmployeeRow,
  TeamAttendanceEmployeesQuery,
  TeamAttendancePage,
  TeamAttendancePeriodQuery,
  TeamAttendanceSummaryResponse
} from '../models/team-attendance.model';

/** The My Team "Team attendance" widget's two reads. Unset filters are left out of the query string. */
@Injectable({ providedIn: 'root' })
export class TeamAttendanceApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking/team`;

  getSummary(query: TeamAttendancePeriodQuery): Observable<TeamAttendanceSummaryResponse> {
    return this.http.get<TeamAttendanceSummaryResponse>(`${this.basePath}/attendance-summary`, {
      params: periodParams(query)
    });
  }

  getEmployees(query: TeamAttendanceEmployeesQuery): Observable<TeamAttendancePage<TeamAttendanceEmployeeRow>> {
    let params = periodParams(query).set('page', query.page).set('pageSize', query.pageSize);
    const search = query.search?.trim();
    if (search) params = params.set('search', search);
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<TeamAttendancePage<TeamAttendanceEmployeeRow>>(`${this.basePath}/attendance-employees`, { params });
  }
}

function periodParams(query: TeamAttendancePeriodQuery): HttpParams {
  let params = new HttpParams().set('mode', query.mode);
  if (query.anchor) params = params.set('anchor', query.anchor);
  if (query.departmentId) params = params.set('departmentId', query.departmentId);
  return params;
}
