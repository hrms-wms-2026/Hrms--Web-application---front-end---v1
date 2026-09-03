import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { SessionExchangeRequestDto } from '../models/dto/session-exchange-request.dto';
import { InvitationPreviewDto } from '../models/dto/invitation-preview.dto';
import { PublishedLegalDocumentDto } from '../models/dto/published-legal-document.dto';
import { AcceptEmployeeInvitationRequestDto } from '../models/dto/accept-employee-invitation-request.dto';

import { getRootHostname } from '../utils/tenant-redirect';

export function getSystemApiUrl(apiUrl: string): string {
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

  /**
   * Root-host-only, like login(): the onevo_legal_pending/onevo_legal_csrf cookies backing this
   * request are issued by the root/system host during login(), so this must retarget the same way
   * or a request made from a tenant host will 401 against a session the tenant host never had.
   */
  acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Observable<AuthResponseDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<AuthResponseDto>(`${baseUrl}${API_ENDPOINTS.legal.completeLogin}`, payload);
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
   * Anonymous, resolves purely by token (no tenant-host requirement) - safe to call from
   * whatever host the invite link opened on.
   */
  getInvitationPreview(token: string): Observable<InvitationPreviewDto> {
    return this.http.get<InvitationPreviewDto>(`${environment.apiUrl}${API_ENDPOINTS.auth.invitationPreview(token)}`);
  }

  /** Anonymous, tenant-agnostic read of the currently-required legal document versions. */
  getCurrentLegalDocuments(): Observable<PublishedLegalDocumentDto[]> {
    return this.http.get<PublishedLegalDocumentDto[]>(`${environment.apiUrl}${API_ENDPOINTS.legal.currentDocuments}`);
  }

  /**
   * Tenant-host-only, like sessionExchange(): the invite link points at the employee's own
   * tenant subdomain, and AcceptEmployeeInvitationCommandHandler requires ITenantContext to
   * resolve to the invitation's tenant, so this must run on whatever host the browser is
   * currently on - it must NOT retarget to the root/system host like login() does.
   */
  acceptEmployeeInvitation(token: string, payload: AcceptEmployeeInvitationRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.acceptEmployeeInvitation(token)}`,
      payload
    );
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
