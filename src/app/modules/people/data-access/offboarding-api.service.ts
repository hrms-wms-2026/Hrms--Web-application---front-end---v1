import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BypassRequestResponse,
  ChecklistTemplateMatchResponse,
  CreateBypassRequestRequest,
  EmployeeChecklistTaskResponse,
  OffboardingRecordResponse,
  StartOffboardingRequest,
  UpdateEmployeeChecklistTaskRequest
} from '../models/offboarding.model';

@Injectable({ providedIn: 'root' })
export class OffboardingApiService {
  private readonly http = inject(HttpClient);

  private idempotencyHeaders(): { 'Idempotency-Key': string } {
    return { 'Idempotency-Key': crypto.randomUUID() };
  }

  startOffboarding(employeeId: string, payload: StartOffboardingRequest): Observable<{ offboardingRecordId: string }> {
    return this.http.post<{ offboardingRecordId: string }>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding`, payload, { headers: this.idempotencyHeaders() });
  }

  getOffboarding(employeeId: string): Observable<OffboardingRecordResponse | null> {
    return this.http.get<OffboardingRecordResponse | null>(`${environment.apiUrl}/employees/${employeeId}/offboarding`);
  }

  getChecklistMatches(employeeId: string): Observable<readonly ChecklistTemplateMatchResponse[]> {
    return this.http.get<readonly ChecklistTemplateMatchResponse[]>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/checklist-matches`);
  }

  selectChecklist(employeeId: string, templateId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/select-checklist`, { templateId }, { headers: this.idempotencyHeaders() });
  }

  cancelOffboarding(employeeId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/cancel`, {}, { headers: this.idempotencyHeaders() });
  }

  completeOffboarding(employeeId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/complete`, {}, { headers: this.idempotencyHeaders() });
  }

  listChecklistTasks(employeeId: string): Observable<readonly EmployeeChecklistTaskResponse[]> {
    return this.http.get<readonly EmployeeChecklistTaskResponse[]>(`${environment.apiUrl}/employees/${employeeId}/checklist-tasks`);
  }

  updateChecklistTask(employeeId: string, taskId: string, payload: UpdateEmployeeChecklistTaskRequest): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}`, payload);
  }

  completeChecklistTask(employeeId: string, taskId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}/complete`, {}, { headers: this.idempotencyHeaders() });
  }

  createBypassRequest(employeeId: string, taskId: string, payload: CreateBypassRequestRequest): Observable<{ bypassRequestId: string }> {
    return this.http.post<{ bypassRequestId: string }>(
      `${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}/bypass-requests`, payload, { headers: this.idempotencyHeaders() });
  }

  listMyPendingBypassRequests(): Observable<readonly BypassRequestResponse[]> {
    return this.http.get<readonly BypassRequestResponse[]>(
      `${environment.apiUrl}/offboarding-bypass-requests`, { params: { status: 'pending' } });
  }

  approveBypassRequest(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/offboarding-bypass-requests/${id}/approve`, {}, { headers: this.idempotencyHeaders() });
  }

  rejectBypassRequest(id: string, decisionComment: string | null): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/offboarding-bypass-requests/${id}/reject`, { decisionComment }, { headers: this.idempotencyHeaders() });
  }
}
