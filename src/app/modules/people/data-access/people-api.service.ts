import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BulkChangeEmploymentTypePayload,
  BulkChangePositionPayload,
  BulkEmployeeActionResponse,
  BulkStartOffboardingPayload,
  ChangePositionPayload,
  ChangePositionResponse,
  EmployeeDetailResponse,
  EmployeeIdentityResponse,
  EmployeeListItemResponse,
  EmployeeListPageResponse,
  EmployeeListParams,
  ResendInvitationResponse,
  UpdateEmployeeJobDetailsRequest
} from '../models/employee.model';
import { PendingAccessGrantRequestResponse } from '../models/access-grant-request.model';
import { ChecklistAssignee } from '../models/checklist-template.model';
import { PositionHistoryEntryResponse } from '../models/position-history.model';
import { EmployeeWorkGraphResponse } from '../models/work-graph.model';
import {
  EmployeeActivityOverviewResponse,
  EmployeeApprovalActivityResponse,
  EmployeeAttendanceDisciplineResponse,
  EmployeeAttendanceOverviewResponse,
  EmployeeChecklistOverviewResponse,
  EmployeeDeliveryResponse,
  EmployeeHistoryResponse,
  EmployeeOverviewSignalsResponse,
  EmployeeRecentActivityResponse,
  EmployeeSignalItemsResponse,
  EmployeeTimeOffResponse,
  EmployeeUpcomingResponse,
  EmployeeWorkOverviewResponse
} from '../models/employee-overview.model';
import {
  ApproveAccessGrantRequestResponse,
  DraftListPageResponse,
  DraftListParams,
  EmployeeNumberAvailabilityResponse,
  EmployeeNumberSuggestionResponse,
  FinalizeOnboardingDraftResponse,
  ActiveHolder,
  OnboardingDraftResponse,
  RejectAccessGrantRequestRequest,
  RejectAccessGrantRequestResponse,
  SaveOnboardingDraftPayload,
  WorkModeOption
} from '../models/onboarding-draft.model';

/**
 * Targets HRMS-Backend-v1 EmployeesController (GET /api/v1/employees, GET /api/v1/employees/{id},
 * POST /api/v1/employees/{id}/resend-invitation),
 * OnboardingDraftsController (GET/POST/PUT /api/v1/onboarding/drafts, POST /api/v1/onboarding/drafts/{id}/finalize),
 * WorkModesController (GET /api/v1/work-modes?legalEntityId={id}), and AccessGrantRequestsController
 * (POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite, POST /api/v1/onboarding/access-grant-requests/{id}/reject).
 */
@Injectable({ providedIn: 'root' })
export class PeopleApiService {
  private readonly http = inject(HttpClient);

  getWorkModes(legalEntityId: string): Observable<readonly WorkModeOption[]> {
    return this.http.get<readonly WorkModeOption[]>(`${environment.apiUrl}/work-modes`, {
      params: new HttpParams().set('legalEntityId', legalEntityId)
    });
  }

  listEmployees(params: EmployeeListParams): Observable<EmployeeListPageResponse> {
    return this.http.get<EmployeeListPageResponse>(`${environment.apiUrl}/employees`, {
      params: this.toHttpParams(params)
    });
  }

  getEmployee(id: string): Observable<EmployeeListItemResponse> {
    return this.http.get<EmployeeListItemResponse>(`${environment.apiUrl}/employees/${id}`);
  }

  /** Name + avatar only, for any employee in the tenant - no employees:read required. */
  getEmployeeIdentity(id: string): Observable<EmployeeIdentityResponse> {
    return this.http.get<EmployeeIdentityResponse>(`${environment.apiUrl}/employees/${id}/identity`);
  }

  resendInvitation(id: string): Observable<ResendInvitationResponse> {
    return this.http.post<ResendInvitationResponse>(`${environment.apiUrl}/employees/${id}/resend-invitation`, {});
  }

  setTrayAppAccess(id: string, enabled: boolean): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/employees/${id}/tray-app-access`, { enabled });
  }

  getEmployeeDetail(id: string): Observable<EmployeeDetailResponse> {
    return this.http.get<EmployeeDetailResponse>(`${environment.apiUrl}/employees/${id}/detail`);
  }

  changePosition(id: string, payload: ChangePositionPayload): Observable<ChangePositionResponse> {
    return this.http.post<ChangePositionResponse>(`${environment.apiUrl}/employees/${id}/change-position`, payload);
  }

  updateJobDetails(id: string, payload: UpdateEmployeeJobDetailsRequest): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/employees/${id}/job-details`, payload);
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

  /** Discards a draft (server marks it cancelled); idempotent. */
  cancelDraft(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/onboarding/drafts/${id}`);
  }

  finalizeDraft(id: string): Observable<FinalizeOnboardingDraftResponse> {
    return this.http.post<FinalizeOnboardingDraftResponse>(`${environment.apiUrl}/onboarding/drafts/${id}/finalize`, {});
  }

  getEmployeeNumberSuggestion(legalEntityId: string): Observable<EmployeeNumberSuggestionResponse> {
    return this.http.get<EmployeeNumberSuggestionResponse>(
      `${environment.apiUrl}/onboarding/employee-number-suggestion`,
      { params: this.toHttpParams({ legalEntityId }) }
    );
  }

  checkEmployeeNumberAvailability(
    employeeNumber: string,
    excludeEmployeeId?: string
  ): Observable<EmployeeNumberAvailabilityResponse> {
    return this.http.get<EmployeeNumberAvailabilityResponse>(
      `${environment.apiUrl}/onboarding/employee-number-availability`,
      { params: this.toHttpParams({ employeeNumber, excludeEmployeeId }) }
    );
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

  listPendingApprovals(): Observable<PendingAccessGrantRequestResponse[]> {
    return this.http.get<PendingAccessGrantRequestResponse[]>(
      `${environment.apiUrl}/onboarding/access-grant-requests/pending-for-me`
    );
  }

  getJobJourney(employeeId: string): Observable<PositionHistoryEntryResponse[]> {
    return this.http.get<PositionHistoryEntryResponse[]>(
      `${environment.apiUrl}/employees/${employeeId}/position-history`
    );
  }

  getWorkGraph(employeeId: string): Observable<EmployeeWorkGraphResponse> {
    return this.http.get<EmployeeWorkGraphResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-graph`
    );
  }

  getOverviewAttendance(employeeId: string, from: string, to: string): Observable<EmployeeAttendanceOverviewResponse> {
    return this.http.get<EmployeeAttendanceOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/attendance`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getOverviewAttendanceDiscipline(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeAttendanceDisciplineResponse> {
    return this.http.get<EmployeeAttendanceDisciplineResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/attendance-discipline`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewWork(employeeId: string, from: string, to: string): Observable<EmployeeWorkOverviewResponse> {
    return this.http.get<EmployeeWorkOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/work`,
      { params: this.periodParams(from, to, false) }
    );
  }

  getOverviewDelivery(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeDeliveryResponse> {
    return this.http.get<EmployeeDeliveryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/delivery`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewActivity(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeActivityOverviewResponse> {
    return this.http.get<EmployeeActivityOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/activity`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewApprovals(employeeId: string, from: string, to: string): Observable<EmployeeApprovalActivityResponse> {
    return this.http.get<EmployeeApprovalActivityResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/approvals`,
      { params: this.periodParams(from, to, false) }
    );
  }

  getOverviewSignals(employeeId: string, from: string, to: string): Observable<EmployeeOverviewSignalsResponse> {
    return this.http.get<EmployeeOverviewSignalsResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/signals`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getOverviewSignalItems(
    employeeId: string,
    key: string,
    from: string,
    to: string
  ): Observable<EmployeeSignalItemsResponse> {
    return this.http.get<EmployeeSignalItemsResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/signals/${encodeURIComponent(key)}/items`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getOverviewUpcoming(employeeId: string, days = 14): Observable<EmployeeUpcomingResponse> {
    return this.http.get<EmployeeUpcomingResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/upcoming`,
      { params: new HttpParams().set('days', String(days)) }
    );
  }

  getOverviewChecklists(employeeId: string): Observable<EmployeeChecklistOverviewResponse> {
    return this.http.get<EmployeeChecklistOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/checklists`
    );
  }

  getOverviewHistory(employeeId: string, limit = 10): Observable<EmployeeHistoryResponse> {
    return this.http.get<EmployeeHistoryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/history`,
      { params: new HttpParams().set('limit', String(limit)) }
    );
  }

  getOverviewRecentActivity(
    employeeId: string,
    before?: string | null,
    limit = 20
  ): Observable<EmployeeRecentActivityResponse> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) {
      params = params.set('before', before);
    }
    return this.http.get<EmployeeRecentActivityResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/recent-activity`,
      { params }
    );
  }

  getOverviewTimeOff(employeeId: string, year?: number): Observable<EmployeeTimeOffResponse> {
    let params = new HttpParams();
    if (year !== undefined) {
      params = params.set('year', String(year));
    }
    return this.http.get<EmployeeTimeOffResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/time-off`,
      { params }
    );
  }

  getActiveHolders(legalEntityId: string, positionId: string): Observable<readonly ActiveHolder[]> {
    return this.http.get<readonly ActiveHolder[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/active-holders`
    );
  }

  getChecklistAssigneePositions(legalEntityId: string): Observable<readonly { id: string; name: string }[]> {
    return this.http.get<readonly { id: string; name: string }[]>(
      `${environment.apiUrl}/people/checklist-assignee-positions`,
      { params: this.toHttpParams({ legalEntityId }) }
    );
  }

  getChecklistAssignees(legalEntityId: string, positionId: string): Observable<readonly ChecklistAssignee[]> {
    return this.http.get<readonly ChecklistAssignee[]>(`${environment.apiUrl}/people/checklist-assignees`, {
      params: this.toHttpParams({ legalEntityId, positionId })
    });
  }

  bulkChangePosition(payload: BulkChangePositionPayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/change-position`, payload);
  }

  bulkChangeEmploymentType(payload: BulkChangeEmploymentTypePayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/employment-type`, payload);
  }

  bulkStartOffboarding(payload: BulkStartOffboardingPayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/offboarding/start`, payload);
  }

  private toHttpParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          httpParams = httpParams.append(key, String(item));
        }
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  private periodParams(from: string, to: string, comparePrevious: boolean): HttpParams {
    const params = new HttpParams().set('from', from).set('to', to);
    return comparePrevious ? params.set('compare', 'previous') : params;
  }
}
