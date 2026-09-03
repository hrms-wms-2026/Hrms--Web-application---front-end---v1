import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from './auth-api.service';
import { environment } from '@environments/environment';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

// Simulates the app running on a tenant subdomain (e.g. acme.localhost:4200), where
// environment.apiUrl is same-origin-derived and therefore also points at the tenant host
// (acme.localhost:7229). This is the scenario the base-login legal-acceptance bug happened in:
// requests that must run on the root/system host have to retarget away from this value, while
// sessionExchange/me/logout must NOT.
//
// `environment` is declared `as const satisfies RuntimeConfig` for compile-time readonly-ness
// only - it's a plain mutable object at runtime (not Object.frozen), and every module that
// imports it shares this one instance, so mutating apiUrl here reaches AuthApiService without
// needing module mocking (which doesn't intercept Angular's pre-bundled esbuild spec chunks -
// verified empirically: a `vi.mock('@environments/environment', ...)` in this file had no effect
// on the value AuthApiService observed).
describe('AuthApiService on a tenant host', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;
  let originalApiUrl: string;

  const sampleResponse: AuthResponseDto = {
    authenticated: true,
    user: { email: 'a@b.com' },
    permissions: [],
    active_modules: [],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: null,
    continue_url: null,
    workspace: { slug: 'acme', display_name: 'Acme' }
  };

  beforeEach(() => {
    originalApiUrl = environment.apiUrl;
    (environment as { apiUrl: string }).apiUrl = 'https://acme.localhost:7229/api/v1';

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    (environment as { apiUrl: string }).apiUrl = originalApiUrl;
    httpMock.verify();
  });

  it('retargets login() to the root host', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    const req = httpMock.expectOne('https://localhost:7229/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(sampleResponse);
  });

  it('retargets acceptLegalDocuments() to the root host', () => {
    const payload = { acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' as const }] };
    service.acceptLegalDocuments(payload).subscribe();
    const req = httpMock.expectOne('https://localhost:7229/api/v1/legal/acceptances/complete-login');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body)).toEqual(['acceptances']);
    req.flush(sampleResponse);
  });

  it('keeps sessionExchange() on the current tenant host', () => {
    service.sessionExchange('raw-exchange-code').subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/session-exchange');
    expect(req.request.method).toBe('POST');
    req.flush(sampleResponse);
  });

  it('keeps me() on the current tenant host', () => {
    service.me().subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/me');
    req.flush(sampleResponse);
  });

  it('keeps logout() on the current tenant host', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/logout');
    req.flush(null);
  });

  it('keeps getInvitationPreview() on the current tenant host', () => {
    service.getInvitationPreview('raw-token').subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/invitations/raw-token');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('sends a Base64Url-safe token (dashes/underscores) through untouched', () => {
    const urlSafeToken = 'AbCd-_09_ThisIsUrlSafe-1234567890';
    service.getInvitationPreview(urlSafeToken).subscribe();
    const req = httpMock.expectOne(`https://acme.localhost:7229/api/v1/auth/invitations/${urlSafeToken}`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('percent-encodes a legacy Base64 token containing +, /, = so the path segment stays intact', () => {
    service.getInvitationPreview('ab+c/d==').subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/invitations/ab%2Bc%2Fd%3D%3D');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('keeps getCurrentLegalDocuments() on the current tenant host', () => {
    service.getCurrentLegalDocuments().subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/legal/documents/current');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('keeps acceptEmployeeInvitation() on the current tenant host - it must NOT retarget to the root host like login() does, because AcceptEmployeeInvitationCommandHandler requires ITenantContext to resolve to the invitation tenant', () => {
    const payload = { password: 'Password123!', confirm_password: 'Password123!', acceptances: [] };
    service.acceptEmployeeInvitation('raw-token', payload).subscribe();
    const req = httpMock.expectOne('https://acme.localhost:7229/api/v1/auth/invitations/raw-token/accept-employee');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(sampleResponse);
  });
});
