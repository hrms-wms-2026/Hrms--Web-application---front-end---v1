import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ChangePositionPayload,
  EmployeeDetailResponse,
  EmployeeListItemResponse,
  EmployeeListPageResponse,
  EmployeeListParams
} from '../models/employee.model';
import {
  ApproveAccessGrantRequestResponse,
  DraftListPageResponse,
  DraftListParams,
  FinalizeOnboardingDraftResponse,
  OnboardingDraftResponse,
  RejectAccessGrantRequestRequest,
  RejectAccessGrantRequestResponse,
  SaveOnboardingDraftPayload,
  WorkModeOption
} from '../models/onboarding-draft.model';

/**
 * Targets HRMS-Backend-v1 EmployeesController (GET /api/v1/employees, GET /api/v1/employees/{id}),
 * OnboardingDraftsController (GET/POST/PUT /api/v1/onboarding/drafts, POST /api/v1/onboarding/drafts/{id}/finalize),
 * WorkModesController (GET /api/v1/work-modes), and AccessGrantRequestsController
 * (POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite, POST /api/v1/onboarding/access-grant-requests/{id}/reject).
 */
@Injectable({ providedIn: 'root' })
export class PeopleApiService {
  private readonly http = inject(HttpClient);

  getWorkModes(): Observable<readonly WorkModeOption[]> {
    return this.http.get<readonly WorkModeOption[]>(`${environment.apiUrl}/work-modes`);
  }

  listEmployees(params: EmployeeListParams): Observable<EmployeeListPageResponse> {
    return this.http.get<EmployeeListPageResponse>(`${environment.apiUrl}/employees`, {
      params: this.toHttpParams(params)
    });
  }

  getEmployee(id: string): Observable<EmployeeListItemResponse> {
    return this.http.get<EmployeeListItemResponse>(`${environment.apiUrl}/employees/${id}`);
  }

  getEmployeeDetail(id: string): Observable<EmployeeDetailResponse> {
    return this.http.get<EmployeeDetailResponse>(`${environment.apiUrl}/employees/${id}/detail`);
  }

  changePosition(id: string, payload: ChangePositionPayload): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/employees/${id}/change-position`, payload);
  }

  listDrafts(params: DraftListParams): Observable<DraftListPageResponse> {
    return this.http.get<DraftListPageResponse>(`${environment.apiUrl}/onboarding/drafts`, {
      params: this.toHttpParams(params)
    });
  }

  getDraft(id: string): Observable<OnboardingDraftResponse> {
    return this.http.get<OnboardingDraftResponse>(`${environment.apiUrl}/onboarding/drafts/${id}`);
  }

  /** POST when payload.draftId is absent, PUT (with If-Match) when present. */
  saveDraft(payload: SaveOnboardingDraftPayload, expectedVersion: string | null): Observable<OnboardingDraftResponse> {
    const { draftId, ...body } = payload;
    const headers: Record<string, string> = { 'Idempotency-Key': crypto.randomUUID() };

    if (draftId) {
      if (expectedVersion) {
        headers['If-Match'] = expectedVersion;
      }
      return this.http.put<OnboardingDraftResponse>(`${environment.apiUrl}/onboarding/drafts/${draftId}`, body, {
        headers
      });
    }

    return this.http.post<OnboardingDraftResponse>(`${environment.apiUrl}/onboarding/drafts`, body, { headers });
  }

  finalizeDraft(id: string): Observable<FinalizeOnboardingDraftResponse> {
    return this.http.post<FinalizeOnboardingDraftResponse>(`${environment.apiUrl}/onboarding/drafts/${id}/finalize`, {});
  }

  approveAccessGrantRequest(id: string): Observable<ApproveAccessGrantRequestResponse> {
    return this.http.post<ApproveAccessGrantRequestResponse>(
      `${environment.apiUrl}/onboarding/access-grant-requests/${id}/approve-and-send-invite`,
      {}
    );
  }

  rejectAccessGrantRequest(
    id: string,
    payload?: RejectAccessGrantRequestRequest
  ): Observable<RejectAccessGrantRequestResponse> {
    return this.http.post<RejectAccessGrantRequestResponse>(
      `${environment.apiUrl}/onboarding/access-grant-requests/${id}/reject`,
      payload ?? {}
    );
  }

  private toHttpParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params as Record<string, string | number | undefined>)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value);
      }
    }
    return httpParams;
  }
}
