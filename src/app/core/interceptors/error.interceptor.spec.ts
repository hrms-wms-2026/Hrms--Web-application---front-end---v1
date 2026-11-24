import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { NO_EMPLOYEE_DETAIL, SILENT_HTTP_ERRORS, errorInterceptor } from './error.interceptor';
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

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('never retries a %s after a 500 (a retried write can be applied twice)', async (method) => {
    vi.useFakeTimers();
    let errored = false;
    http.request(method, '/api/v1/calendar', { body: {} }).subscribe({ error: () => (errored = true) });

    const req = httpMock.expectOne('/api/v1/calendar');
    req.flush({}, { status: 500, statusText: 'Server Error' });
    await vi.advanceTimersByTimeAsync(2000);

    expect(errored).toBe(true);
    httpMock.expectNone('/api/v1/calendar');
  });

  it('never retries a POST that failed with status 0 (the server may have already applied it)', async () => {
    vi.useFakeTimers();
    let errored = false;
    http.post('/api/v1/calendar', {}).subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/v1/calendar').error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(2000);

    expect(errored).toBe(true);
    httpMock.expectNone('/api/v1/calendar');
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

  it('does not show an error for the no-employee-profile 403', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/my/progress').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/my/progress')
      .flush({ detail: NO_EMPLOYEE_DETAIL }, { status: 403, statusText: 'Forbidden' });

    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not show an error for the no-employee-profile 404', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/my/documents').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/my/documents')
      .flush({ detail: NO_EMPLOYEE_DETAIL }, { status: 404, statusText: 'Not Found' });

    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not show an error for the Leave screens wording of the no-employee-profile response', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/leave/requests').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/leave/requests')
      .flush({ detail: 'No employee record is linked to the current user.' }, { status: 403, statusText: 'Forbidden' });

    expect(notify.notifications()).toHaveLength(0);
  });

  it('still shows other 403s', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/employees').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/employees')
      .flush({ detail: 'You cannot do that.' }, { status: 403, statusText: 'Forbidden' });

    expect(notify.notifications()).toHaveLength(1);
  });

  it('clears the session and redirects to /auth/login on a CSRF-shaped 403 (stale/expired session)', () => {
    const clearSpy = vi.spyOn(authStore, 'clearSession');
    const navigateSpy = vi.spyOn(router, 'navigate');
    const notify = TestBed.inject(NotificationService);

    http.put('/api/v1/work/projects/p1', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/work/projects/p1');
    req.flush(
      {
        type: 'urn:crownus:error:csrf',
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

  it('does not banner an error for a request marked SILENT_HTTP_ERRORS - the caller handles it', () => {
    const notify = TestBed.inject(NotificationService);
    let failed = false;

    http.get('/api/v1/inbox/people/e1/cases', { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) })
      .subscribe({ error: () => (failed = true) });
    httpMock.expectOne('/api/v1/inbox/people/e1/cases').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(failed).toBe(true);
    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not banner a 429 from tray activation generate — the presence store owns that message', () => {
    const notify = TestBed.inject(NotificationService);

    http.post('/api/v1/monitoring/activation/generate', null).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/monitoring/activation/generate');
    req.flush(
      { detail: 'Too many activation codes requested. Please wait a few minutes before trying again.' },
      { status: 429, statusText: 'Too Many Requests' }
    );

    expect(notify.notifications()).toHaveLength(0);
  });

  describe('single-host tenant mismatch 403', () => {
    const mutableEnv = environment as unknown as { tenancyMode: string };
    const MISMATCH = { status: 403, detail: 'Token tenant does not match request host tenant.' };
    let originalMode: string;

    beforeEach(() => {
      originalMode = mutableEnv.tenancyMode;
      sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    });

    afterEach(() => {
      mutableEnv.tenancyMode = originalMode;
      sessionStorage.clear();
    });

    function fail403(body: Record<string, unknown>): void {
      http.get('/api/v1/employees').subscribe({ error: () => undefined });
      httpMock.expectOne('/api/v1/employees').flush(body, { status: 403, statusText: 'Forbidden' });
    }

    it('clears the slug and the session and redirects to /auth/login', () => {
      mutableEnv.tenancyMode = 'single-host';
      const clearSpy = vi.spyOn(authStore, 'clearSession');
      const navigateSpy = vi.spyOn(router, 'navigate');
      const notify = TestBed.inject(NotificationService);

      fail403(MISMATCH);

      expect(sessionStorage.getItem('crownus.singleHostTenant')).toBeNull();
      expect(clearSpy).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
      expect(notify.notifications()).toHaveLength(0);
    });

    it('does not loop: with the slug cleared a repeat 403 is only an ordinary error', () => {
      mutableEnv.tenancyMode = 'single-host';
      fail403(MISMATCH);
      const navigateSpy = vi.spyOn(router, 'navigate');
      fail403({ status: 403, detail: 'Caller is not the project lead.' });
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('subdomain mode keeps the old behaviour for the same 403', () => {
      mutableEnv.tenancyMode = 'subdomain';
      const navigateSpy = vi.spyOn(router, 'navigate');

      fail403(MISMATCH);

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('crownus.singleHostTenant')).toBe('acme');
    });

    it('an ordinary 403 in single-host mode keeps the old behaviour', () => {
      mutableEnv.tenancyMode = 'single-host';
      const navigateSpy = vi.spyOn(router, 'navigate');

      fail403({ status: 403, detail: 'Caller is not the project lead.' });

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('crownus.singleHostTenant')).toBe('acme');
    });
  });
});
