import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AttendanceHistoryRow,
  AttendanceTodayResponse,
  ClockInRequest
} from '../models/time-tracking.model';

@Injectable({ providedIn: 'root' })
export class TimeTrackingApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking`;

  getToday(): Observable<AttendanceTodayResponse> {
    return this.http.get<AttendanceTodayResponse>(`${this.basePath}/today`);
  }

  getMyHistory(from: string, to: string): Observable<readonly AttendanceHistoryRow[]> {
    return this.http.get<readonly AttendanceHistoryRow[]>(`${this.basePath}/history`, {
      params: this.rangeParams(from, to)
    });
  }

  getCoveredHistory(
    from: string,
    to: string,
    employeeId?: string
  ): Observable<readonly AttendanceHistoryRow[]> {
    let params = this.rangeParams(from, to);
    if (employeeId) {
      params = params.set('employeeId', employeeId);
    }

    return this.http.get<readonly AttendanceHistoryRow[]>(`${this.basePath}/covered-history`, {
      params
    });
  }

  clockIn(): Observable<AttendanceTodayResponse> {
    const request: ClockInRequest = { source: 'web' };
    return this.http.post<AttendanceTodayResponse>(`${this.basePath}/clock-in`, request);
  }

  startBreak(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/break/start`);
  }

  endBreak(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/break/end`);
  }

  clockOut(): Observable<AttendanceTodayResponse> {
    return this.postWithoutBody(`${this.basePath}/clock-out`);
  }

  private rangeParams(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }

  /** HttpClient requires the body argument; null produces an empty POST body. */
  private postWithoutBody(url: string): Observable<AttendanceTodayResponse> {
    return this.http.post<AttendanceTodayResponse>(url, null);
  }
}
