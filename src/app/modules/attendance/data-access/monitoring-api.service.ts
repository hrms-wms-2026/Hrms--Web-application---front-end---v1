import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  MonitoringFeatureTogglesRequest,
  MonitoringPolicyConfiguration,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest,
  MonitoringScopeType
} from '../models/monitoring.model';

@Injectable({ providedIn: 'root' })
export class MonitoringApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/monitoring/policy`;

  getPolicy(): Observable<MonitoringPolicyConfiguration> {
    return this.http.get<MonitoringPolicyConfiguration>(this.basePath);
  }

  updateCompany(payload: MonitoringFeatureTogglesRequest): Observable<unknown> {
    return this.http.put<unknown>(`${this.basePath}/company`, payload);
  }

  upsertOverride(
    scope: MonitoringScopeType,
    targetId: string,
    payload: MonitoringPolicyOverrideRequest
  ): Observable<MonitoringPolicyOverride> {
    return this.http.put<MonitoringPolicyOverride>(`${this.basePath}/${scope}/${encodeURIComponent(targetId)}`, payload);
  }

  deleteOverride(scope: MonitoringScopeType, targetId: string): Observable<void> {
    return this.http.delete<void>(`${this.basePath}/${scope}/${encodeURIComponent(targetId)}`);
  }
}
