import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([csrfInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.cookie = 'onevo_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'onevo_legal_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    httpMock.verify();
  });

  it('sets X-CSRF-Token from onevo_csrf on a POST', () => {
    document.cookie = 'onevo_csrf=full-session-token';

    http.post('/api/v1/employees', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/employees');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('full-session-token');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('falls back to onevo_legal_csrf when onevo_csrf is absent', () => {
    document.cookie = 'onevo_legal_csrf=pending-consent-token';

    http.post('/api/v1/legal/acceptances/complete-login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/legal/acceptances/complete-login');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('pending-consent-token');
    req.flush({});
  });

  it('does not set the header on a GET', () => {
    document.cookie = 'onevo_csrf=full-session-token';

    http.get('/api/v1/employees').subscribe();

    const req = httpMock.expectOne('/api/v1/employees');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });

  it('sends no header when neither cookie is present', () => {
    http.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });
});
