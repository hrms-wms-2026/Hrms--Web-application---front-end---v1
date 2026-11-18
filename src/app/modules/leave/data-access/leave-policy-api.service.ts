import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
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
const BASE = '/leave/policies';

/** Client for ONEVO.Api's LeavePoliciesController at /api/v1/leave/policies. */
@Injectable({ providedIn: 'root' })
export class LeavePolicyApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive = false): Observable<readonly LeavePolicyListItem[]> {
    return this.api.get<readonly LeavePolicyListItem[]>(BASE, { params: { includeInactive } });
  }

  get(policyId: string): Observable<LeavePolicyDetail> {
    return this.api.get<LeavePolicyDetail>(`${BASE}/${policyId}`);
  }

  /** Emits the new policy id, or errors with LeavePolicyConflictError. */
  create(payload: CreateLeavePolicyRequest): Observable<string> {
    return this.api.post<{ id: string }>(BASE, payload).pipe(map((r) => r.id), catchError(toConflictError));
  }

  updateDetails(policyId: string, payload: UpdateLeavePolicyDetailsRequest): Observable<void> {
    return this.api.put<void>(`${BASE}/${policyId}`, payload);
  }

  addVersion(policyId: string, payload: AddLeavePolicyVersionRequest): Observable<string> {
    return this.api.post<string>(`${BASE}/${policyId}/versions`, payload);
  }

  deleteVersion(policyId: string, versionId: string): Observable<void> {
    return this.api.delete<void>(`${BASE}/${policyId}/versions/${versionId}`);
  }

  setAssignments(
    policyId: string, assignments: readonly LeavePolicyAssignmentTarget[], replaceConflicts: boolean
  ): Observable<void> {
    return this.api
      .put<unknown>(`${BASE}/${policyId}/assignments`, { assignments, replaceConflicts })
      .pipe(map(() => undefined), catchError(toConflictError));
  }

  setActive(policyId: string, isActive: boolean): Observable<void> {
    return this.api.post<void>(`${BASE}/${policyId}/${isActive ? 'activate' : 'deactivate'}`, {});
  }

  clone(policyId: string, name: string): Observable<string> {
    return this.api.post<string>(`${BASE}/${policyId}/clone`, { name });
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
