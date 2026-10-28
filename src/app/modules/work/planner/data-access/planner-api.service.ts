import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../core/interceptors/error.interceptor';
import {
  CreatePlannedBlockRequest, MovePlannedBlockRequest, PlannerDayResponse, PlannerFocusResponse, PlannerRangeResponse,
} from '../models/planner.models';

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

  getRange(from: string, to: string): Observable<PlannerRangeResponse> {
    return this.http.get<PlannerRangeResponse>(`${this.baseUrl}/me/range`, {
      params: new HttpParams().set('from', from).set('to', to), ...this.silent,
    });
  }

  getFocus(): Observable<PlannerFocusResponse> {
    return this.http.get<PlannerFocusResponse>(`${this.baseUrl}/me/focus`, this.silent);
  }

  createBlock(request: CreatePlannedBlockRequest): Observable<PlannerDayResponse> {
    return this.http.post<PlannerDayResponse>(`${this.baseUrl}/me/blocks`, request, this.silent);
  }

  moveBlock(blockId: string, request: MovePlannedBlockRequest): Observable<PlannerDayResponse> {
    return this.http.patch<PlannerDayResponse>(`${this.baseUrl}/me/blocks/${blockId}`, request, this.silent);
  }

  deleteBlock(blockId: string): Observable<PlannerDayResponse> {
    return this.http.delete<PlannerDayResponse>(`${this.baseUrl}/me/blocks/${blockId}`, this.silent);
  }

  private dateParams(date: string | null): HttpParams {
    return date ? new HttpParams().set('date', date) : new HttpParams();
  }
}
