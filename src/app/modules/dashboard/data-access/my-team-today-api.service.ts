import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamTodayResponse } from '../models/my-team-today.model';

@Injectable({ providedIn: 'root' })
export class MyTeamTodayApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking/team`;

  getTeamToday(limit = 50): Observable<TeamTodayResponse> {
    return this.http.get<TeamTodayResponse>(`${this.basePath}/today`, {
      params: new HttpParams().set('limit', limit)
    });
  }
}
