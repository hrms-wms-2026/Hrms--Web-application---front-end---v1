import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeaveCalendarFilter, LeaveCalendarMonthResponse } from '../models/leave-calendar.model';

/** Client for ONEVO.Api's LeaveCalendarController at /api/v1/leave/calendar. */
@Injectable({ providedIn: 'root' })
export class LeaveCalendarApiService {
  private readonly http = inject(HttpClient);

  getMonth(filter: LeaveCalendarFilter): Observable<LeaveCalendarMonthResponse> {
    let params = new HttpParams().set('year', filter.year).set('month', filter.month);
    if (filter.departmentId) params = params.set('departmentId', filter.departmentId);
    if (filter.includeTentative !== undefined) params = params.set('includeTentative', filter.includeTentative);
    return this.http.get<LeaveCalendarMonthResponse>(`${environment.apiUrl}/leave/calendar`, { params });
  }
}
