import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ChecklistTemplateDetailResponse,
  ChecklistTemplateListItemResponse,
  ChecklistTemplateListPageResponse,
  ChecklistTemplateListParams,
  CreateChecklistTemplateRequest,
  OnboardingChecklistTemplateMatchResponse,
  UpdateChecklistTemplateRequest
} from '../models/checklist-template.model';

@Injectable({ providedIn: 'root' })
export class ChecklistApiService {
  private readonly http = inject(HttpClient);

  listChecklistTemplates(params: ChecklistTemplateListParams): Observable<ChecklistTemplateListPageResponse> {
    return this.http.get<ChecklistTemplateListPageResponse>(`${environment.apiUrl}/people/checklist-templates`, {
      params: this.toHttpParams(params)
    });
  }

  getChecklistTemplate(id: string): Observable<ChecklistTemplateDetailResponse> {
    return this.http.get<ChecklistTemplateDetailResponse>(`${environment.apiUrl}/people/checklist-templates/${id}`);
  }

  createChecklistTemplate(payload: CreateChecklistTemplateRequest): Observable<ChecklistTemplateDetailResponse> {
    const headers = { 'Idempotency-Key': crypto.randomUUID() };
    return this.http.post<ChecklistTemplateDetailResponse>(
      `${environment.apiUrl}/people/checklist-templates`,
      payload,
      { headers }
    );
  }

  updateChecklistTemplate(
    id: string,
    payload: UpdateChecklistTemplateRequest
  ): Observable<ChecklistTemplateDetailResponse> {
    return this.http.put<ChecklistTemplateDetailResponse>(
      `${environment.apiUrl}/people/checklist-templates/${id}`,
      payload
    );
  }

  archiveChecklistTemplate(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/people/checklist-templates/${id}/archive`, {});
  }

  getOnboardingMatches(params: {
    legalEntityId: string;
    departmentId?: string;
    positionId?: string;
  }): Observable<readonly OnboardingChecklistTemplateMatchResponse[]> {
    return this.http.get<readonly OnboardingChecklistTemplateMatchResponse[]>(
      `${environment.apiUrl}/onboarding/checklist-templates/matches`,
      { params: this.toHttpParams(params) }
    );
  }

  private toHttpParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params as Record<string, string | number | boolean | undefined>)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}
