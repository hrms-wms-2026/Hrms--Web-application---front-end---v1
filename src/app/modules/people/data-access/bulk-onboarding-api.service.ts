import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BulkOnboardingBatchDetailResponse,
  BulkOnboardingBatchResponse,
  BulkOnboardingColumnMapping,
  RowPreviewResponse,
  UploadBulkOnboardingBatchPayload,
  ValidateBulkOnboardingBatchResponse
} from '../models/bulk-onboarding.model';

/**
 * Targets HRMS-Backend-v1 BulkOnboardingController
 * (POST /api/v1/onboarding/bulk-batches, POST .../{id}/preview, POST .../{id}/validate,
 * POST .../{id}/create-drafts, GET .../{id}, POST .../{id}/finalize).
 */
@Injectable({ providedIn: 'root' })
export class BulkOnboardingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding/bulk-batches`;

  upload(payload: UploadBulkOnboardingBatchPayload): Observable<BulkOnboardingBatchResponse> {
    const form = new FormData();
    form.append('file', payload.file, payload.file.name);
    form.append('legalEntityId', payload.legalEntityId);
    if (payload.defaultWorkModeId !== null) form.append('defaultWorkModeId', String(payload.defaultWorkModeId));
    if (payload.defaultEmploymentType !== null) form.append('defaultEmploymentType', payload.defaultEmploymentType);
    if (payload.defaultChecklistTemplateId !== null) form.append('defaultChecklistTemplateId', payload.defaultChecklistTemplateId);

    return this.http.post<BulkOnboardingBatchResponse>(this.baseUrl, form);
  }

  preview(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<RowPreviewResponse> {
    return this.http.post<RowPreviewResponse>(`${this.baseUrl}/${batchId}/preview`, { mapping });
  }

  validate(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<ValidateBulkOnboardingBatchResponse> {
    return this.http.post<ValidateBulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/validate`, { mapping });
  }

  requestCreateDrafts(batchId: string): Observable<BulkOnboardingBatchResponse> {
    return this.http.post<BulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/create-drafts`, {});
  }

  getBatch(batchId: string): Observable<BulkOnboardingBatchDetailResponse> {
    return this.http.get<BulkOnboardingBatchDetailResponse>(`${this.baseUrl}/${batchId}`);
  }

  requestFinalize(batchId: string, onboardingDraftIds: readonly string[]): Observable<BulkOnboardingBatchResponse> {
    return this.http.post<BulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/finalize`, { onboardingDraftIds });
  }
}
