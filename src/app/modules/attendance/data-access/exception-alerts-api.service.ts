import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ExceptionAlertPage, ExceptionAlertQuery, ExceptionEvidenceResponse } from '../models/exception-alert.model';

/**
 * MonitoringExceptionsController - /api/v1/monitoring/exceptions. Which alerts come back is decided
 * server-side: a reporting manager sees their covered employees (IEmployeeAuthorityResolver), HR
 * sees everyone, nobody sees their own.
 */
@Injectable({ providedIn: 'root' })
export class ExceptionAlertsApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/monitoring/exceptions`;

  list(query: ExceptionAlertQuery = {}): Observable<ExceptionAlertPage> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    return this.http.get<ExceptionAlertPage>(this.basePath, { params });
  }

  /** Photo URLs in the response expire in minutes - fetch each time the evidence is opened. */
  evidence(id: string): Observable<ExceptionEvidenceResponse> {
    return this.http.get<ExceptionEvidenceResponse>(`${this.basePath}/${encodeURIComponent(id)}/evidence`);
  }

  acknowledge(id: string): Observable<void> {
    return this.http.post<void>(`${this.basePath}/${encodeURIComponent(id)}/acknowledge`, {});
  }

  resolve(id: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.basePath}/${encodeURIComponent(id)}/resolve`, { note });
  }

  escalate(id: string, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.basePath}/${encodeURIComponent(id)}/escalate`, { note });
  }
}
