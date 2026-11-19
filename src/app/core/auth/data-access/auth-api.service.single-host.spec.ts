import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment';
import { AuthApiService, getTenantApiUrl } from './auth-api.service';

describe('getTenantApiUrl on a single host', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    mutableEnv.tenancyMode = 'single-host';
  });

  afterEach(() => {
    mutableEnv.tenancyMode = originalMode;
  });

  it('returns apiUrl unchanged for a valid slug', () => {
    expect(getTenantApiUrl('https://app.azurewebsites.net/api/v1', 'acme')).toBe('https://app.azurewebsites.net/api/v1');
  });

  it('still rejects an invalid slug', () => {
    expect(() => getTenantApiUrl('https://app.azurewebsites.net/api/v1', 'Bad.Slug')).toThrow();
  });

  it('meForTenant sends X-Crownus-Tenant for the given slug (no slug is stored on the login page)', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const httpMock = TestBed.inject(HttpTestingController);

    TestBed.inject(AuthApiService).meForTenant('acme').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/me'));
    expect(req.request.headers.get('X-Crownus-Tenant')).toBe('acme');
    req.flush({});
    httpMock.verify();
  });

  it('meForTenant sends no tenant header in subdomain mode', () => {
    mutableEnv.tenancyMode = 'subdomain';
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const httpMock = TestBed.inject(HttpTestingController);

    TestBed.inject(AuthApiService).meForTenant('acme').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/me'));
    expect(req.request.headers.has('X-Crownus-Tenant')).toBe(false);
    req.flush({});
    httpMock.verify();
  });
});
