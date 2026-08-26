import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActivationCodeResponse } from '../models/activation-code.model';

/**
 * Self-service desktop-agent activation codes.
 * Matches MonitoringActivationController's POST /monitoring/activation/generate — always
 * scoped to the calling employee's own account server-side (GenerateActivationCodeCommandHandler
 * reads ICurrentUser, never a target employee id), so there is no employeeId parameter here.
 */
@Injectable({ providedIn: 'root' })
export class ActivationApiService {
  private readonly http = inject(HttpClient);

  generate(): Observable<ActivationCodeResponse> {
    return this.http.post<ActivationCodeResponse>(
      `${environment.apiUrl}/monitoring/activation/generate`,
      null
    );
  }
}
