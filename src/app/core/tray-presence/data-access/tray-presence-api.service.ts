import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  TrayActivationCodeResponse,
  TrayPresenceResponse
} from '../models/tray-presence.model';

@Injectable({ providedIn: 'root' })
export class TrayPresenceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/monitoring/activation`;

  getStatus(): Observable<TrayPresenceResponse> {
    return this.http.get<TrayPresenceResponse>(`${this.baseUrl}/status`);
  }

  generateActivationCode(): Observable<TrayActivationCodeResponse> {
    return this.http.post<TrayActivationCodeResponse>(`${this.baseUrl}/generate`, null);
  }
}
