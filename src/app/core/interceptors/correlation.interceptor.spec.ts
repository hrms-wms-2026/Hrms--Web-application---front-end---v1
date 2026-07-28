import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { correlationInterceptor } from './correlation.interceptor';

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([correlationInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches an X-Correlation-ID header shaped like a UUID v4', () => {
    http.get('/api/v1/ping').subscribe();
    const req = httpMock.expectOne('/api/v1/ping');
    const id = req.request.headers.get('X-Correlation-ID');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    req.flush({});
  });

  it('attaches a different id to each request', () => {
    http.get('/api/v1/a').subscribe();
    http.get('/api/v1/b').subscribe();
    const [reqA] = httpMock.match('/api/v1/a');
    const [reqB] = httpMock.match('/api/v1/b');
    expect(reqA.request.headers.get('X-Correlation-ID')).not.toBe(reqB.request.headers.get('X-Correlation-ID'));
    reqA.flush({});
    reqB.flush({});
  });
});
