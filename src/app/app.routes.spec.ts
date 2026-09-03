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
});

describe('app routes - Time Off outer gate', () => {
  it('allows leave:read-team, leave:approve, or leave:read to reach /time-off, not just leave:read-own', () => {
    const shell = routes.find((route) => route.path === '' && route.children)!;
    const timeOff = shell.children!.find((route) => route.path === 'time-off')!;

    expect(timeOff.data?.['permissions']).toEqual([
      'leave:read-own',
      'leave:read-team',
      'leave:approve',
      'leave:read'
    ]);
    expect(timeOff.data?.['modules']).toEqual(['leave']);
  });
});
