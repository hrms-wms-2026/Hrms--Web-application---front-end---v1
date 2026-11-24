import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService, getSystemApiUrl, getTenantApiUrl } from './auth-api.service';
import { environment } from '@environments/environment';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

describe('getSystemApiUrl', () => {
  it('retargets a tenant-subdomain apiUrl to the root hostname, for login() from a tenant host', () => {
    expect(getSystemApiUrl('https://acme.localhost:7229/api/v1')).toBe(
      'https://localhost:7229/api/v1',
    );
  });

  it('retargets a production tenant apiUrl to the root domain', () => {
    expect(getSystemApiUrl('https://acme.onevo.com/api/v1')).toBe('https://onevo.com/api/v1');
  });

  it('leaves an already-root apiUrl unchanged', () => {
    expect(getSystemApiUrl('https://localhost:7229/api/v1')).toBe('https://localhost:7229/api/v1');
  });
});

describe('getTenantApiUrl', () => {
  it('retargets the root apiUrl to the remembered tenant hostname', () => {
    expect(getTenantApiUrl('https://localhost:7229/api/v1', 'acme')).toBe(
      'https://acme.localhost:7229/api/v1',
    );
  });

  it('replaces an existing tenant label instead of stacking subdomains', () => {
    expect(getTenantApiUrl('https://old.onevo.com/api/v1', 'acme')).toBe(
      'https://acme.onevo.com/api/v1',
    );
  });

  it('rejects a malformed cookie value before constructing a URL', () => {
    expect(() => getTenantApiUrl('https://onevo.com/api/v1', 'acme.evil.test')).toThrow(
      'Invalid tenant slug.',
    );
  });
});

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

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
    workspace: { slug: 'acme', display_name: 'Acme' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs credentials to /auth/login', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    req.flush(sampleResponse);
  });

  it('GETs the public Google SSO config from /auth/google-config', () => {
    service.getGoogleSsoConfig().subscribe();
    const req = httpMock.expectOne(`${getSystemApiUrl(environment.apiUrl)}/auth/google-config`);
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: false, clientId: null });
  });

  it('POSTs the Google ID token to /auth/login/google', () => {
    service.loginWithGoogle('id-token-abc').subscribe();
    const req = httpMock.expectOne(`${getSystemApiUrl(environment.apiUrl)}/auth/login/google`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ google_id_token: 'id-token-abc' });
    req.flush(sampleResponse);
  });

  it('POSTs the challenge and chosen workspace to /auth/login/select-workspace', () => {
    service.selectWorkspace({ login_challenge: 'challenge-1', workspace: 'beta' }).subscribe();
    const req = httpMock.expectOne(
      `${getSystemApiUrl(environment.apiUrl)}/auth/login/select-workspace`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login_challenge: 'challenge-1', workspace: 'beta' });
    req.flush(sampleResponse);
  });

  it('POSTs acceptances to /legal/acceptances/complete-login', () => {
    const payload = {
      acceptances: [
        { document_type: 'privacy_notice', version: '1.0', decision: 'accepted' as const },
      ],
    };
    service.acceptLegalDocuments(payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/legal/acceptances/complete-login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(sampleResponse);
  });

  it('GETs /auth/me', () => {
    service.me().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush(sampleResponse);
  });

  it('validates a remembered session against the tenant-host /auth/me endpoint', () => {
    service.meForTenant('acme').subscribe();
    const expectedUrl = `${getTenantApiUrl(environment.apiUrl, 'acme')}/auth/me`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(sampleResponse);
  });

  it('POSTs the code to /auth/session-exchange', () => {
    service.sessionExchange('raw-exchange-code').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/session-exchange`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'raw-exchange-code' });
    req.flush({ ...sampleResponse, authenticated: true });
  });

  it('POSTs to /auth/logout', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
