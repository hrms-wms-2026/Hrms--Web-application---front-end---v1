import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../core/interceptors/error.interceptor';
import {
  CreatePlannedBlockRequest, MovePlannedBlockRequest, PlannerDayResponse, PlannerFocusResponse, PlannerRangeResponse,
} from '../models/planner.models';
import { PlannerPersonRangeResponse, TeamPlannerResponse } from '../models/team-planner.models';

/** Every /api/v1/planner call. Writes return the day they wrote. Every caller shows its own error copy (or hides itself on
 * 503 planner_disabled), so no call raises the global error toast. */
@Injectable({ providedIn: 'root' })
export class PlannerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/planner`;
  private readonly silent = { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) };

  getMyDay(date: string | null): Observable<PlannerDayResponse> {
    return this.http.get<PlannerDayResponse>(`${this.baseUrl}/me`, { params: this.dateParams(date), ...this.silent });
  }

  getEmployeeDay(employeeId: string, date: string | null): Observable<PlannerDayResponse> {
    return this.http.get<PlannerDayResponse>(`${this.baseUrl}/employees/${employeeId}`, { params: this.dateParams(date), ...this.silent });
  }

  /** The caller's days, or a principal's (read-only) when the caller is their meeting delegate (`forEmployeeId`). */
  getRange(from: string, to: string, forEmployeeId?: string | null): Observable<PlannerRangeResponse> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (forEmployeeId) params = params.set('forEmployeeId', forEmployeeId);
    return this.http.get<PlannerRangeResponse>(`${this.baseUrl}/me/range`, { params, ...this.silent });
  }

  /** Team planner (2026-11-03): a manager's direct reports for one day, with detail. */
  getTeamDay(date: string | null, managerId: string | null): Observable<TeamPlannerResponse> {
    let params = this.dateParams(date);
    if (managerId) params = params.set('managerId', managerId);
    return this.http.get<TeamPlannerResponse>(`${this.baseUrl}/team`, { params, ...this.silent });
  }

  /** The same team over a range, minutes only. */
  getTeamRange(from: string, to: string, managerId: string | null): Observable<TeamPlannerResponse> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (managerId) params = params.set('managerId', managerId);
    return this.http.get<TeamPlannerResponse>(`${this.baseUrl}/team/range`, { params, ...this.silent });
  }

  /** One person's days, read-only. */
  getEmployeeRange(employeeId: string, from: string, to: string): Observable<PlannerPersonRangeResponse> {
    return this.http.get<PlannerPersonRangeResponse>(`${this.baseUrl}/employees/${employeeId}/range`, {
      params: new HttpParams().set('from', from).set('to', to), ...this.silent,
    });
  }

  /** The caller's Focus list, or a principal's for their planning delegate (`forEmployeeId`). */
  getFocus(forEmployeeId?: string | null): Observable<PlannerFocusResponse> {
    return this.http.get<PlannerFocusResponse>(`${this.baseUrl}/me/focus`, { params: this.forParams(forEmployeeId), ...this.silent });
  }

  /** `forEmployeeId`: on a principal's planner, by their planning delegate. */
  createBlock(request: CreatePlannedBlockRequest, forEmployeeId?: string | null): Observable<PlannerDayResponse> {
    return this.http.post<PlannerDayResponse>(`${this.baseUrl}/me/blocks`, request, { params: this.forParams(forEmployeeId), ...this.silent });
  }

  moveBlock(blockId: string, request: MovePlannedBlockRequest, forEmployeeId?: string | null): Observable<PlannerDayResponse> {
    return this.http.patch<PlannerDayResponse>(`${this.baseUrl}/me/blocks/${blockId}`, request,
      { params: this.forParams(forEmployeeId), ...this.silent });
  }

  /** `expectedVersion`: the block's `version` as last read (409 when it changed since). */
  deleteBlock(blockId: string, expectedVersion?: string | null, forEmployeeId?: string | null): Observable<PlannerDayResponse> {
    let params = this.forParams(forEmployeeId);
    if (expectedVersion) params = params.set('expectedVersion', expectedVersion);
    return this.http.delete<PlannerDayResponse>(`${this.baseUrl}/me/blocks/${blockId}`, { params, ...this.silent });
  }

  private forParams(forEmployeeId?: string | null): HttpParams {
    return forEmployeeId ? new HttpParams().set('forEmployeeId', forEmployeeId) : new HttpParams();
  }

  private dateParams(date: string | null): HttpParams {
    return date ? new HttpParams().set('date', date) : new HttpParams();
  }
}
