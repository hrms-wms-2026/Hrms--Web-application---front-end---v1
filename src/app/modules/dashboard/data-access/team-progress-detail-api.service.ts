import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  LedEmployeeProgressPage,
  LedEmployeeQuery,
  LedPeriodProgress,
  LedWeeklyCompletion,
  LedProgressPeriod,
  LedTimePeriod,
  LedTimeProgress,
  LedUnscheduledPage,
  LedUnscheduledQuery
} from '../models/team-progress-detail.model';

/** Paged employee breakdown, period summary and weekly completion of the caller's led scope (Team Progress detail dialog). */
@Injectable({ providedIn: 'root' })
export class TeamProgressDetailApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/work/led-progress`;

  getEmployees(query: LedEmployeeQuery): Observable<LedEmployeeProgressPage> {
    return this.http.get<LedEmployeeProgressPage>(`${this.basePath}/employees`, { params: toParams({ ...query }) });
  }

  /** Hours and task counts of tasks due this week or month. 'all' has no endpoint here: it is the
   * existing led-progress payload. */
  getPeriodProgress(
    period: Exclude<LedProgressPeriod, 'all'>,
    filters: { projectId?: string; objectiveId?: string } = {}
  ): Observable<LedPeriodProgress> {
    return this.http.get<LedPeriodProgress>(`${this.basePath}/period`, { params: toParams({ period, ...filters }) });
  }

  /** Completed task estimates per bucket: the last `weeks` ISO weeks (no period), the days of this
   * week (`week`) or the weeks of this month (`month`); oldest first, current bucket last. */
  getWeeklyCompletion(
    weeks = 10,
    filters: { projectId?: string; objectiveId?: string } = {},
    period?: Exclude<LedProgressPeriod, 'all'>
  ): Observable<LedWeeklyCompletion> {
    return this.http.get<LedWeeklyCompletion>(`${this.basePath}/weekly-completion`, { params: toParams({ weeks, period, ...filters }) });
  }

  /** Planned vs worked minutes, unscheduled work and the workload ranking for this week or month. */
  getTimeProgress(period: LedTimePeriod, filters: { projectId?: string; objectiveId?: string } = {}): Observable<LedTimeProgress> {
    return this.http.get<LedTimeProgress>(`${this.basePath}/time`, { params: toParams({ period, ...filters }) });
  }

  /** One page of unscheduled work (newest first) for a kind, with every kind's totals. Paged on the server. */
  getUnscheduledWork(query: LedUnscheduledQuery): Observable<LedUnscheduledPage> {
    return this.http.get<LedUnscheduledPage>(`${this.basePath}/time/unscheduled`, { params: toParams({ ...query }) });
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
