import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UpsertWorkModeRequest, WorkMode } from '../models/work-mode.model';

@Injectable({ providedIn: 'root' })
export class WorkModeApiService {
  private readonly http = inject(HttpClient);

  private basePath(legalEntityId: string): string {
    return `${environment.apiUrl}/attendance/legal-entities/${legalEntityId}/work-modes`;
  }

  list(legalEntityId: string, includeInactive: boolean): Observable<WorkMode[]> {
    return this.http.get<WorkMode[]>(this.basePath(legalEntityId), {
      params: { includeInactive: String(includeInactive) }
    });
  }

  create(legalEntityId: string, payload: UpsertWorkModeRequest): Observable<WorkMode> {
    return this.http.post<WorkMode>(this.basePath(legalEntityId), payload);
  }

  update(legalEntityId: string, id: string, payload: UpsertWorkModeRequest): Observable<WorkMode> {
    return this.http.put<WorkMode>(`${this.basePath(legalEntityId)}/${id}`, payload);
  }

  deactivate(legalEntityId: string, id: string): Observable<void> {
    return this.http.post<void>(`${this.basePath(legalEntityId)}/${id}/deactivate`, {});
  }
}
