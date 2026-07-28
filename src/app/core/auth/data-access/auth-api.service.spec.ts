import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from './auth-api.service';
import { environment } from '@environments/environment';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

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
    continue_url: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
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

  it('POSTs acceptances to /legal/acceptances/complete-login', () => {
    const payload = { acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' as const }] };
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

  it('POSTs to /auth/logout', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
