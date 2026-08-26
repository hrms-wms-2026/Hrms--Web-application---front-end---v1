import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
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

  it('resolves /settings/devices to ConnectDeviceComponent', async () => {
    const success = await router.navigateByUrl('/settings/devices');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/devices');
  });

  it('defines the guarded lazy-loaded Attendance → Time Tracking route', () => {
    const attendance = routes.find((route) => route.path === 'attendance');
    expect(attendance).toBeTruthy();
    expect(attendance?.loadChildren).toBeTypeOf('function');
    expect(attendance?.data).toEqual({
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read'],
      modules: ['time_attendance']
    });

    const legacyRoute = routes.find((route) => route.path === 'time-attendance');
    expect(legacyRoute?.redirectTo).toBe('attendance/time-tracking');
  });
});
