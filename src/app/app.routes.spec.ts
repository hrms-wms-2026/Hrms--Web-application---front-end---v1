import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AuthStore } from './core/auth/state/auth.store';
import { PermissionService } from './core/auth/state/permission.service';

describe('app routes - Settings', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(true) } },
        {
          provide: PermissionService,
          useValue: { hasAnyPermission: () => true, hasAnyModule: () => true, hasPermission: () => true }
        }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  it('redirects /settings to /settings/general', async () => {
    await router.navigateByUrl('/settings');
    expect(router.url).toBe('/settings/general');
  });

  it('resolves /settings/general to GeneralSettingsComponent', async () => {
    const success = await router.navigateByUrl('/settings/general');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/general');
  });

  it('resolves /settings/bulk-onboarding to BulkOnboardingComponent', async () => {
    const success = await router.navigateByUrl('/settings/bulk-onboarding');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/bulk-onboarding');
  });

  it('defines the guarded lazy-loaded Attendance route under the authenticated shell', () => {
    const authenticatedShell = routes.find(
      (route) =>
        route.path === '' &&
        route.canActivate?.includes(authGuard) &&
        Array.isArray(route.children)
    );
    expect(authenticatedShell).toBeTruthy();

    const shellChildren = authenticatedShell?.children ?? [];
    const attendance = shellChildren.find((route) => route.path === 'attendance');
    expect(attendance).toBeTruthy();
    expect(attendance?.loadChildren).toBeTypeOf('function');
    expect(attendance?.canActivate).toContain(permissionGuard);
    expect(attendance?.data?.['modules']).toEqual(['time_attendance']);
    expect(attendance?.data?.['permissions']).toEqual([
      'attendance:read-own',
      'attendance:write-own',
      'attendance:read',
      'attendance:approve'
    ]);

    const legacyRoute = shellChildren.find((route) => route.path === 'time-attendance');
    expect(legacyRoute).toBeTruthy();
    expect(legacyRoute?.redirectTo).toBe('attendance/time-tracking');
  });

  it('lets any Time Off child permission through the parent /time-off gate', () => {
    const authenticatedShell = routes.find(
      (route) => route.path === '' && route.canActivate?.includes(authGuard) && Array.isArray(route.children)
    );
    const timeOff = authenticatedShell?.children?.find((route) => route.path === 'time-off');
    expect(timeOff?.canActivate).toContain(permissionGuard);
    expect(timeOff?.data?.['permissions']).toEqual([
      'leave:read-own',
      'leave:read-team',
      'leave:read',
      'leave:manage',
      'leave:approve',
      'calendar:read'
    ]);
  });
});

describe('app routes - already-authenticated tabs skip the login form', () => {
  // Reproduces the "new tab asks me to log in again" bug: a tab landing on /auth/login (or an
  // unmatched URL, which redirects there) must not render the login form when the browser
  // already carries a valid session cookie - it should land in the app like any other guarded
  // route already does.
  let router: Router;

  async function setUp(authenticated: boolean) {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(authenticated) } },
        {
          provide: PermissionService,
          useValue: { hasAnyPermission: () => true, hasAnyModule: () => true, hasPermission: () => true }
        }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
  }

  it('redirects an already-authenticated tab away from /auth/login to /dashboard', async () => {
    await setUp(true);

    await router.navigateByUrl('/auth/login');

    expect(router.url).toBe('/dashboard');
  });

  it('redirects an already-authenticated tab landing on an unmatched URL to /dashboard', async () => {
    await setUp(true);

    await router.navigateByUrl('/some/bookmarked/url-that-no-longer-exists');

    expect(router.url).toBe('/dashboard');
  });

  it('still shows the login form for a guest with no session', async () => {
    await setUp(false);

    const success = await router.navigateByUrl('/auth/login');

    expect(success).toBe(true);
    expect(router.url).toBe('/auth/login');
  });
});
