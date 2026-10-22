import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AddLeavePolicyVersionRequest,
  CreateLeavePolicyRequest,
  LeavePolicyAssignmentConflict,
  LeavePolicyAssignmentTarget,
  LeavePolicyConflictError,
  LeavePolicyDetail,
  LeavePolicyListItem,
  UpdateLeavePolicyDetailsRequest
} from '../models/leave-policy.model';

const CONFLICT_CODE = 'leave_policy.assignment_conflict';

/** Client for ONEVO.Api's LeavePoliciesController at /api/v1/leave/policies. */
@Injectable({ providedIn: 'root' })
export class LeavePolicyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/leave/policies`;

  list(includeInactive = false): Observable<readonly LeavePolicyListItem[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<readonly LeavePolicyListItem[]>(this.baseUrl, { params });
  }

  get(policyId: string): Observable<LeavePolicyDetail> {
    return this.http.get<LeavePolicyDetail>(`${this.baseUrl}/${policyId}`);
  }

  /** Emits the new policy id, or errors with LeavePolicyConflictError. */
  create(payload: CreateLeavePolicyRequest): Observable<string> {
    return this.http.post<{ id: string }>(this.baseUrl, payload).pipe(map((r) => r.id), catchError(toConflictError));
  }

  updateDetails(policyId: string, payload: UpdateLeavePolicyDetailsRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${policyId}`, payload);
  }

  addVersion(policyId: string, payload: AddLeavePolicyVersionRequest): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/${policyId}/versions`, payload);
  }

  deleteVersion(policyId: string, versionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${policyId}/versions/${versionId}`);
  }

  setAssignments(
    policyId: string, assignments: readonly LeavePolicyAssignmentTarget[], replaceConflicts: boolean
  ): Observable<void> {
    return this.http
      .put<unknown>(`${this.baseUrl}/${policyId}/assignments`, { assignments, replaceConflicts })
      .pipe(map(() => undefined), catchError(toConflictError));
  }

  setActive(policyId: string, isActive: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${policyId}/${isActive ? 'activate' : 'deactivate'}`, {});
  }

  clone(policyId: string, name: string): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/${policyId}/clone`, { name });
  }
}

function toConflictError(err: unknown): Observable<never> {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    const body = err.error as { code?: string; conflicts?: LeavePolicyAssignmentConflict[] } | null;
    if (body?.code === CONFLICT_CODE)
      return throwError(() => new LeavePolicyConflictError(body.conflicts ?? []));
  }
  return throwError(() => err);
}
