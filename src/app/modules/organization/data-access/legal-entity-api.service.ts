import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  LegalEntityGeneralSettings,
  LegalEntityListItem,
  UpdateLegalEntityGeneralSettingsRequest
} from '../models/legal-entity.model';

/**
 * Minimal Legal Entity API service for fetching tenant companies list.
 * Targets backend endpoint GET /api/v1/org/legal-entities (LegalEntitiesController.cs:29-37).
 * Requires org:read permission.
 */
@Injectable({ providedIn: 'root' })
export class LegalEntityApiService {
  private readonly http = inject(HttpClient);

  getLegalEntities(includeInactive = false): Observable<readonly LegalEntityListItem[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<readonly LegalEntityListItem[]>(`${environment.apiUrl}/org/legal-entities`, { params });
  }

  getGeneralSettings(legalEntityId: string): Observable<LegalEntityGeneralSettings> {
    return this.http.get<LegalEntityGeneralSettings>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/general-settings`
    );
  }

  updateGeneralSettings(
    legalEntityId: string,
    payload: UpdateLegalEntityGeneralSettingsRequest
  ): Observable<LegalEntityGeneralSettings> {
    return this.http.put<LegalEntityGeneralSettings>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/general-settings`,
      payload
    );
  }
}
