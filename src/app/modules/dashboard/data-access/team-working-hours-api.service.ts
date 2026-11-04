import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamWorkingHoursResponse } from '../models/my-team-today.model';

/** The Working / Break / Leave popup's week trend (attendance worked and break minutes per day). */
@Injectable({ providedIn: 'root' })
export class TeamWorkingHoursApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/time-tracking/team`;

  /** weekStart: an ISO Monday (yyyy-MM-dd); null = this week. */
  getWeek(weekStart: string | null = null): Observable<TeamWorkingHoursResponse> {
    let params = new HttpParams();
    if (weekStart) params = params.set('weekStart', weekStart);
    return this.http.get<TeamWorkingHoursResponse>(`${this.basePath}/working-hours`, { params });
  }
}
