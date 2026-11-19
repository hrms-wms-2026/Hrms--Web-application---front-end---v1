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
import { ForgotPasswordRequestDto } from '../models/dto/forgot-password-request.dto';
import { ResetPasswordRequestDto } from '../models/dto/reset-password-request.dto';
import { MessageResponseDto } from '../models/dto/message-response.dto';
import { GoogleSsoConfigDto } from '../models/dto/google-sso-config.dto';
import { GoogleLoginRequestDto } from '../models/dto/google-login-request.dto';
import { LoginResultDto, SelectWorkspaceRequestDto } from '../models/dto/workspace-selection.dto';

import { isSingleHostMode, TENANT_HEADER } from '../utils/single-host-tenant';
import { getRootHostname, isValidTenantSlug } from '../utils/tenant-redirect';

export function getSystemApiUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    url.hostname = getRootHostname(url.hostname);
    return url.toString().replace(/\/$/, '');
  } catch {
    return apiUrl;
  }
}

export function getTenantApiUrl(apiUrl: string, tenantSlug: string): string {
  if (!isValidTenantSlug(tenantSlug)) {
    throw new Error('Invalid tenant slug.');
  }

  if (isSingleHostMode()) {
    return apiUrl;
  }

  const url = new URL(apiUrl);
  url.hostname = `${tenantSlug}.${getRootHostname(url.hostname)}`;
  return url.toString().replace(/\/$/, '');
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);

  /** Root-host only. 200 = AuthResponseDto, 202 = WorkspaceSelectionRequiredDto. */
  login(payload: LoginRequestDto): Observable<LoginResultDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<LoginResultDto>(`${baseUrl}${API_ENDPOINTS.auth.login}`, payload);
  }

  /** Anonymous, root-host only (the backend rejects it on a tenant host, like login/google). */
  getGoogleSsoConfig(): Observable<GoogleSsoConfigDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.get<GoogleSsoConfigDto>(`${baseUrl}${API_ENDPOINTS.auth.googleConfig}`);
  }

  /**
   * Root-host only, like login(): AuthLoginController.LoginWithGoogle returns 400 on a tenant host.
   * Same 200/202 outcomes as login(). The ID token is only ever held in this request body.
   */
  loginWithGoogle(idToken: string): Observable<LoginResultDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    const payload: GoogleLoginRequestDto = { google_id_token: idToken };
    return this.http.post<LoginResultDto>(`${baseUrl}${API_ENDPOINTS.auth.loginGoogle}`, payload);
  }

  /** Root-host only: completes a 202 from login() or loginWithGoogle(). */
  selectWorkspace(payload: SelectWorkspaceRequestDto): Observable<AuthResponseDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<AuthResponseDto>(
      `${baseUrl}${API_ENDPOINTS.auth.selectWorkspace}`,
      payload,
    );
  }

  /**
   * Root-host-only, like login(): the crownus_legal_pending/crownus_legal_csrf cookies backing this
   * request are issued by the root/system host during login(), so this must retarget the same way
   * or a request made from a tenant host will 401 against a session the tenant host never had.
   */
  acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Observable<AuthResponseDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<AuthResponseDto>(
      `${baseUrl}${API_ENDPOINTS.legal.completeLogin}`,
      payload,
    );
  }

  /**
   * Tenant-host-only. Must run on whatever host the browser is currently on (the tenant subdomain
   * continue_url navigated to) - unlike login(), this deliberately does NOT retarget to the system
   * host.
   */
  sessionExchange(code: string): Observable<AuthResponseDto> {
    const payload: SessionExchangeRequestDto = { code };
    return this.http.post<AuthResponseDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.sessionExchange}`,
      payload,
    );
  }

  /**
   * Anonymous, resolves purely by token (no tenant-host requirement) - safe to call from
   * whatever host the invite link opened on.
   */
  getInvitationPreview(token: string): Observable<InvitationPreviewDto> {
    return this.http.get<InvitationPreviewDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.invitationPreview(token)}`,
    );
  }

  /** Anonymous, tenant-agnostic read of the currently-required legal document versions. */
  getCurrentLegalDocuments(): Observable<PublishedLegalDocumentDto[]> {
    return this.http.get<PublishedLegalDocumentDto[]>(
      `${environment.apiUrl}${API_ENDPOINTS.legal.currentDocuments}`,
    );
  }

  /**
   * Tenant-host-only, like sessionExchange(): the invite link points at the employee's own
   * tenant subdomain, and AcceptEmployeeInvitationCommandHandler requires ITenantContext to
   * resolve to the invitation's tenant, so this must run on whatever host the browser is
   * currently on - it must NOT retarget to the root/system host like login() does.
   */
  acceptEmployeeInvitation(
    token: string,
    payload: AcceptEmployeeInvitationRequestDto,
  ): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.acceptEmployeeInvitation(token)}`,
      payload,
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
   * Validates a remembered session from the root login page against the hinted tenant host.
   * The hint itself is not proof of authentication; only a successful /auth/me response is.
   */
  meForTenant(tenantSlug: string): Observable<AuthResponseDto> {
    const baseUrl = getTenantApiUrl(environment.apiUrl, tenantSlug);
    // Single-host: no slug is stored on the login page yet, so name the tenant on this request itself.
    const headers = isSingleHostMode() ? { [TENANT_HEADER]: tenantSlug } : undefined;
    return this.http.get<AuthResponseDto>(`${baseUrl}${API_ENDPOINTS.auth.me}`, { headers });
  }

  /**
   * Confirmed against AuthSessionController: POST /auth/logout, [Authorize(TenantPolicy)],
   * calls SignOutAsync and returns 204 No Content — no response body, matching Observable<void>.
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}${API_ENDPOINTS.auth.logout}`, {});
  }

  /**
   * Anonymous, whatever host it's called from: AuthPasswordController branches server-side on
   * tenant vs. base host context, so unlike login() this must NOT retarget to the root/system host.
   * Always resolves with the same generic message regardless of whether the email exists.
   */
  forgotPassword(email: string): Observable<MessageResponseDto> {
    const payload: ForgotPasswordRequestDto = { email };
    return this.http.post<MessageResponseDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.forgotPassword}`,
      payload,
    );
  }

  /**
   * Anonymous, tenant-host-only in practice: the emailed reset link lands on the tenant's own
   * subdomain (see EmailTemplateRenderer.ApplyTenantSlug), so this deliberately does not retarget
   * to the root/system host like login() does.
   */
  resetPassword(token: string, newPassword: string): Observable<MessageResponseDto> {
    const payload: ResetPasswordRequestDto = { token, newPassword };
    return this.http.post<MessageResponseDto>(
      `${environment.apiUrl}${API_ENDPOINTS.auth.resetPassword}`,
      payload,
    );
  }
}
