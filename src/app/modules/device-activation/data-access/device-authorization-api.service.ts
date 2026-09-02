import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DeviceAuthorizationPreview, ApproveDeviceAuthorizationRequest } from '../models/device-authorization.model';

@Injectable({ providedIn: 'root' })
export class DeviceAuthorizationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/monitoring/device-authorization`;

  preview(requestId: string, userCode: string): Observable<DeviceAuthorizationPreview> {
    return this.http.get<DeviceAuthorizationPreview>(`${this.baseUrl}/${encodeURIComponent(requestId)}`, {
      params: { user_code: userCode }
    });
  }

  approve(request: ApproveDeviceAuthorizationRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/approve`, request);
  }
}
