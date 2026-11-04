import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamScheduleResponse, TeamScheduleWeekResponse } from '../models/team-schedule.model';

@Injectable({ providedIn: 'root' })
export class TeamScheduleApiService {
  private readonly http = inject(HttpClient);
  // planner/team itself is the team planner's (2026-11-04 merge); the day lives under /schedule.
  private readonly url = `${environment.apiUrl}/planner/team`;

  /** date: yyyy-MM-dd, today or earlier; null = each report's own today. */
  getTeamDay(date: string | null = null): Observable<TeamScheduleResponse> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<TeamScheduleResponse>(`${this.url}/schedule`, { params });
  }

  /** weekStart: a Monday (yyyy-MM-dd), this week or earlier; null = the viewer's current week. */
  getTeamWeek(weekStart: string | null): Observable<TeamScheduleWeekResponse> {
    let params = new HttpParams();
    if (weekStart) params = params.set('weekStart', weekStart);
    return this.http.get<TeamScheduleWeekResponse>(`${this.url}/week`, { params });
  }
}
