import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FileApiService, buildFileUrl } from '../../../shared/data-access/file-api.service';
import {
  CreateLegalEntityRequest,
  LegalEntityGeneralSettings,
  LegalEntityListItem,
  UpdateLegalEntityGeneralSettingsRequest
} from '../models/legal-entity.model';

/**
 * Legal Entity API service. Selector reads are session-scoped; Organization management
 * operations remain on the permission-protected /org/legal-entities routes.
 */
@Injectable({ providedIn: 'root' })
export class LegalEntityApiService {
  private readonly http = inject(HttpClient);
  private readonly fileApi = inject(FileApiService);

  getLegalEntities(includeInactive = false): Observable<readonly LegalEntityListItem[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<readonly LegalEntityListItem[]>(`${environment.apiUrl}/org/legal-entities`, { params });
  }

  getAccessibleCompanies(): Observable<readonly LegalEntityListItem[]> {
    return this.http.get<readonly LegalEntityListItem[]>(`${environment.apiUrl}/session/companies`);
  }

  createLegalEntity(payload: CreateLegalEntityRequest): Observable<LegalEntityGeneralSettings> {
    return this.http.post<LegalEntityGeneralSettings>(`${environment.apiUrl}/org/legal-entities`, payload);
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

  /** Two steps, like the avatar: upload a pending company_logo file, then link it to the company. */
  uploadLogo(legalEntityId: string, file: File): Observable<{ legalEntityId: string; logoFileId: string | null }> {
    return this.fileApi.upload(file, 'company_logo').pipe(
      switchMap((uploaded) =>
        this.http.put<{ legalEntityId: string; logoFileId: string | null }>(
          `${environment.apiUrl}/org/legal-entities/${legalEntityId}/logo`,
          { fileId: uploaded.fileId }
        )
      )
    );
  }

  removeLogo(legalEntityId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/org/legal-entities/${legalEntityId}/logo`);
  }

  switchActiveCompany(legalEntityId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/session/active-company`, { legalEntityId });
  }

  /** Pure helper - no request. The logo is served by the shared file route; a re-upload gets a new
   * file id, so the URL changes with it. */
  getLogoUrl(_legalEntityId: string, logoFileId: string): string {
    return buildFileUrl(logoFileId);
  }
}
