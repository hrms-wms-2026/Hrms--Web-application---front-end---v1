import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { SessionExchangeRequestDto } from '../models/dto/session-exchange-request.dto';

import { getRootHostname } from '../utils/tenant-redirect';

function getSystemApiUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    url.hostname = getRootHostname(url.hostname);
    return url.toString().replace(/\/$/, '');
  } catch {
    return apiUrl;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);

  login(payload: LoginRequestDto): Observable<AuthResponseDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<AuthResponseDto>(`${baseUrl}${API_ENDPOINTS.auth.login}`, payload);
  }

  acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${environment.apiUrl}${API_ENDPOINTS.legal.completeLogin}`, payload);
  }

  /**
   * Tenant-host-only. Must run on whatever host the browser is currently on (the tenant subdomain
   * continue_url navigated to) - unlike login(), this deliberately does NOT retarget to the system
   * host.
   */
  sessionExchange(code: string): Observable<AuthResponseDto> {
    const payload: SessionExchangeRequestDto = { code };
    return this.http.post<AuthResponseDto>(`${environment.apiUrl}${API_ENDPOINTS.auth.sessionExchange}`, payload);
  }

  /**
   * Confirmed against AuthSessionController: GET /auth/me, [Authorize(TenantPolicy)],
   * backed by GetCurrentSessionQuery. Response shape on success not yet confirmed beyond
   * the 401-when-unauthenticated ProblemDetails body verified against the dev backend.
   * Adjust AuthResponseDto here if the authenticated shape differs once confirmed.
   */
  me(): Observable<AuthResponseDto> {
    return this.http.get<AuthResponseDto>(`${environment.apiUrl}${API_ENDPOINTS.auth.me}`);
  }

  /**
   * Confirmed against AuthSessionController: POST /auth/logout, [Authorize(TenantPolicy)],
   * calls SignOutAsync and returns 204 No Content — no response body, matching Observable<void>.
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}${API_ENDPOINTS.auth.logout}`, {});
  }
}
