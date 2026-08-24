import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ClockInPolicyListItemResponse,
  ClockInPolicyResponse,
  UpsertClockInPolicyRequest
} from '../models/clock-in-policy.model';

/**
 * Legal-entity-scoped Clock-in Policy API.
 * Matches LegalEntityClockInPoliciesController routes under
 * /api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies.
 *
 * Settings UI uses list + get to resolve the company-wide policy, then create or update.
 * Archive/restore are not used by the company-wide settings screen.
 */
@Injectable({ providedIn: 'root' })
export class ClockInPolicyApiService {
  private readonly http = inject(HttpClient);

  private basePath(legalEntityId: string): string {
    return `${environment.apiUrl}/attendance/legal-entities/${legalEntityId}/clock-in-policies`;
  }

  list(legalEntityId: string, includeInactive = false): Observable<readonly ClockInPolicyListItemResponse[]> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<readonly ClockInPolicyListItemResponse[]>(this.basePath(legalEntityId), { params });
  }

  get(legalEntityId: string, id: string): Observable<ClockInPolicyResponse> {
    return this.http.get<ClockInPolicyResponse>(`${this.basePath(legalEntityId)}/${id}`);
  }

  create(legalEntityId: string, payload: UpsertClockInPolicyRequest): Observable<ClockInPolicyResponse> {
    return this.http.post<ClockInPolicyResponse>(this.basePath(legalEntityId), payload);
  }

  update(
    legalEntityId: string,
    id: string,
    payload: UpsertClockInPolicyRequest
  ): Observable<ClockInPolicyResponse> {
    return this.http.put<ClockInPolicyResponse>(`${this.basePath(legalEntityId)}/${id}`, payload);
  }
}
