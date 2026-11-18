import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { CreateLeaveHolidayRequest, LeaveCalendarFilter, LeaveCalendarMonthResponse, LeaveHolidayResponse } from '../models/leave-calendar.model';

/** Client for ONEVO.Api's LeaveCalendarController at /api/v1/leave/calendar. */
@Injectable({ providedIn: 'root' })
export class LeaveCalendarApiService {
  private readonly api = inject(ApiClient);

  getMonth(filter: LeaveCalendarFilter): Observable<LeaveCalendarMonthResponse> {
    return this.api.get<LeaveCalendarMonthResponse>('/leave/calendar', {
      params: { year: filter.year, month: filter.month, departmentId: filter.departmentId, includeTentative: filter.includeTentative }
    });
  }

  listHolidays(from: string, to: string): Observable<LeaveHolidayResponse[]> {
    return this.api.get<LeaveHolidayResponse[]>('/leave/holidays', { params: { from, to } });
  }

  createHoliday(payload: CreateLeaveHolidayRequest): Observable<LeaveHolidayResponse> {
    return this.api.post<LeaveHolidayResponse>('/leave/holidays', payload);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.api.delete<void>(`/leave/holidays/${id}`);
  }
}
