import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateLeaveHolidayRequest, LeaveCalendarFilter, LeaveCalendarMonthResponse, LeaveHolidayResponse } from '../models/leave-calendar.model';

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

  listHolidays(from: string, to: string): Observable<LeaveHolidayResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<LeaveHolidayResponse[]>(`${environment.apiUrl}/leave/holidays`, { params });
  }

  createHoliday(payload: CreateLeaveHolidayRequest): Observable<LeaveHolidayResponse> {
    return this.http.post<LeaveHolidayResponse>(`${environment.apiUrl}/leave/holidays`, payload);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/leave/holidays/${id}`);
  }
}
