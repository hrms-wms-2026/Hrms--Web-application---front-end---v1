import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment';
import { tenantHeaderInterceptor } from './tenant-header.interceptor';

const mutableEnv = environment as unknown as { tenancyMode: string; apiUrl: string };

describe('tenantHeaderInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let originalMode: string;
  let originalApiUrl: string;

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    originalApiUrl = mutableEnv.apiUrl;
    mutableEnv.tenancyMode = 'single-host';
    mutableEnv.apiUrl = 'https://app.azurewebsites.net/api/v1';
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([tenantHeaderInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    mutableEnv.tenancyMode = originalMode;
    mutableEnv.apiUrl = originalApiUrl;
    sessionStorage.clear();
  });

  it('adds header for same-origin API call when slug stored', () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    http.get('https://app.azurewebsites.net/api/v1/me').subscribe();
    const req = httpMock.expectOne('https://app.azurewebsites.net/api/v1/me');
    expect(req.request.headers.get('X-Crownus-Tenant')).toBe('acme');
    req.flush({});
  });

  it('adds header for relative request URLs when the API url is absolute same-origin', () => {
    mutableEnv.apiUrl = `${window.location.origin}/api/v1`;
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    http.get('/api/v1/me').subscribe();
    const req = httpMock.expectOne('/api/v1/me');
    expect(req.request.headers.get('X-Crownus-Tenant')).toBe('acme');
    req.flush({});
  });

  it('handles a relative apiUrl: API origin is window.location.origin', () => {
    mutableEnv.apiUrl = '/api/v1';
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    http.get('/api/v1/me').subscribe();
    http.get(`${window.location.origin}/api/v1/x`).subscribe();
    http.get('https://other.example.com/api/v1/x').subscribe();
    const a = httpMock.expectOne('/api/v1/me');
    const b = httpMock.expectOne(`${window.location.origin}/api/v1/x`);
    const c = httpMock.expectOne('https://other.example.com/api/v1/x');
    expect(a.request.headers.get('X-Crownus-Tenant')).toBe('acme');
    expect(b.request.headers.get('X-Crownus-Tenant')).toBe('acme');
    expect(c.request.headers.has('X-Crownus-Tenant')).toBe(false);
    a.flush({});
    b.flush({});
    c.flush({});
  });

  it('no header without slug', () => {
    http.get('https://app.azurewebsites.net/api/v1/me').subscribe();
    const req = httpMock.expectOne('https://app.azurewebsites.net/api/v1/me');
    expect(req.request.headers.has('X-Crownus-Tenant')).toBe(false);
    req.flush({});
  });

  it('no header for other origins', () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    http.get('https://evil.example.com/api/v1/me').subscribe();
    const req = httpMock.expectOne('https://evil.example.com/api/v1/me');
    expect(req.request.headers.has('X-Crownus-Tenant')).toBe(false);
    req.flush({});
  });

  it('no header in subdomain mode', () => {
    mutableEnv.tenancyMode = 'subdomain';
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    http.get('https://app.azurewebsites.net/api/v1/me').subscribe();
    const req = httpMock.expectOne('https://app.azurewebsites.net/api/v1/me');
    expect(req.request.headers.has('X-Crownus-Tenant')).toBe(false);
    req.flush({});
  });
});
