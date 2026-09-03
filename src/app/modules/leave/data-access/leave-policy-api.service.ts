import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CloneLeavePolicyRequest, CreateLeavePolicyRequest, LeavePolicyListItemResponse, LeavePolicyResponse } from '../models/leave-policy.model';
@Injectable({ providedIn: 'root' })
export class LeavePolicyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/leave/policies`;
  list(): Observable<readonly LeavePolicyListItemResponse[]> { return this.http.get<readonly LeavePolicyListItemResponse[]>(this.baseUrl); }
  get(policyId: string): Observable<LeavePolicyResponse> { return this.http.get<LeavePolicyResponse>(`${this.baseUrl}/${policyId}`); }
  create(payload: CreateLeavePolicyRequest): Observable<LeavePolicyResponse> { return this.http.post<LeavePolicyResponse>(this.baseUrl, payload); }
  clone(policyId: string, payload: CloneLeavePolicyRequest): Observable<LeavePolicyResponse> { return this.http.post<LeavePolicyResponse>(`${this.baseUrl}/${policyId}/clone`, payload); }
}
