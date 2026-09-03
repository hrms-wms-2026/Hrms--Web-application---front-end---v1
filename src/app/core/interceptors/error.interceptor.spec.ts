import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { AuthStore } from '../auth/state/auth.store';
import { NotificationService } from '../services/notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let authStore: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    authStore = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('retries a 500 three times with backoff before failing', async () => {
    vi.useFakeTimers();
    let errored = false;
    http.get('/api/v1/employees').subscribe({ error: () => (errored = true) });

    for (let i = 0; i < 4; i++) {
      const req = httpMock.expectOne('/api/v1/employees');
      req.flush({}, { status: 500, statusText: 'Server Error' });
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(errored).toBe(true);
  });

  it('does not retry a 404', () => {
    let errored = false;
    http.get('/api/v1/employees/9').subscribe({ error: () => (errored = true) });

    const req = httpMock.expectOne('/api/v1/employees/9');
    req.flush({}, { status: 404, statusText: 'Not Found' });

    expect(errored).toBe(true);
  });

  it('clears the session and redirects to /auth/login on a 401 from a protected endpoint', () => {
    const clearSpy = vi.spyOn(authStore, 'clearSession');
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.get('/api/v1/employees').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/employees');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(clearSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('does not redirect on a 401 from /auth/login (invalid credentials)', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.post('/api/v1/auth/login', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ detail: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 from /auth/me (guard handles it itself)', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.get('/api/v1/auth/me').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('forwards a 403 to ErrorHandlerService for banner display', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/employees').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/employees');
    req.flush({}, { status: 403, statusText: 'Forbidden' });

    expect(notify.notifications()[0].message).toBe('You do not have access to perform this action.');
  });

  it('clears the session and redirects to /auth/login on a CSRF-shaped 403 (stale/expired session)', () => {
    const clearSpy = vi.spyOn(authStore, 'clearSession');
    const navigateSpy = vi.spyOn(router, 'navigate');
    const notify = TestBed.inject(NotificationService);

    http.put('/api/v1/work/projects/p1', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/work/projects/p1');
    req.flush(
      {
        type: 'https://onevo.com/errors/csrf',
        title: 'Forbidden',
        status: 403,
        detail: 'A valid CSRF token is required for this request.'
      },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(clearSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not treat an ordinary permission-denied 403 as a CSRF/session error', () => {
    const clearSpy = vi.spyOn(authStore, 'clearSession');
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.put('/api/v1/work/projects/p1', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/work/projects/p1');
    req.flush(
      { type: 'about:blank', title: 'Forbidden', status: 403, detail: 'Caller is not the project lead.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(clearSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
