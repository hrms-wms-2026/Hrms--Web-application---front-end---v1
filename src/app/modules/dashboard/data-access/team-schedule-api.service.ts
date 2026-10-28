import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamScheduleResponse } from '../models/team-schedule.model';

@Injectable({ providedIn: 'root' })
export class TeamScheduleApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/planner/team`;

  /** date: yyyy-MM-dd, today or earlier; null = each report's own today. */
  getTeamDay(date: string | null = null): Observable<TeamScheduleResponse> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<TeamScheduleResponse>(this.url, { params });
  }
}
