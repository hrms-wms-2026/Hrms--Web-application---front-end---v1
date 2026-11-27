import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../core/interceptors/error.interceptor';
import { SelfSetupStatusDto } from '../models/self-setup-status.model';

@Injectable({ providedIn: 'root' })
export class SelfSetupApiService {
  private readonly http = inject(HttpClient);

  /** Silent: without employees:write this is a 403, and the panel then just shows its title. */
  getStatus(): Observable<SelfSetupStatusDto> {
    return this.http.get<SelfSetupStatusDto>(`${environment.apiUrl}/onboarding/drafts/self-setup`, {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true)
    });
  }
}
