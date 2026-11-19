import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamWorkTaskHoursResponse, TeamWorkTaskQuery } from '../models/team-work-task.model';

/** The My Team "Work vs task hours" widget's one read. An unset anchor is left out of the query string. */
@Injectable({ providedIn: 'root' })
export class TeamWorkTaskApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking/team`;

  get(query: TeamWorkTaskQuery): Observable<TeamWorkTaskHoursResponse> {
    let params = new HttpParams().set('period', query.period);
    if (query.anchor) params = params.set('anchor', query.anchor);
    return this.http.get<TeamWorkTaskHoursResponse>(`${this.basePath}/work-vs-task`, { params });
  }
}
