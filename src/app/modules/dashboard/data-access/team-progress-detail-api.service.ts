import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  LedEmployeeProgressPage,
  LedEmployeeQuery,
  LedPeriodProgress,
  LedProgressPeriod,
  LedTaskPage,
  LedTaskQuery
} from '../models/team-progress-detail.model';

/** Paged employee / task breakdowns of the caller's led scope (Team Progress detail dialog). */
@Injectable({ providedIn: 'root' })
export class TeamProgressDetailApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/work/led-progress`;

  getEmployees(query: LedEmployeeQuery): Observable<LedEmployeeProgressPage> {
    return this.http.get<LedEmployeeProgressPage>(`${this.basePath}/employees`, { params: toParams({ ...query }) });
  }

  getTasks(query: LedTaskQuery): Observable<LedTaskPage> {
    return this.http.get<LedTaskPage>(`${this.basePath}/tasks`, { params: toParams({ ...query }) });
  }

  /** Hours and task counts of tasks due this week or month. 'all' has no endpoint here: it is the
   * existing led-progress payload. */
  getPeriodProgress(
    period: Exclude<LedProgressPeriod, 'all'>,
    filters: { projectId?: string; objectiveId?: string } = {}
  ): Observable<LedPeriodProgress> {
    return this.http.get<LedPeriodProgress>(`${this.basePath}/period`, { params: toParams({ period, ...filters }) });
  }
}

/** Skips empty optional filters so the backend applies its defaults. */
function toParams(query: Record<string, string | number | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params = params.set(key, value);
  }
  return params;
}
