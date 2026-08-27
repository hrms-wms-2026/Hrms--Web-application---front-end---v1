import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PermissionService } from '../../core/auth/state/permission.service';
import { ConnectDeviceComponent } from '../settings/feature/connect-device/connect-device.component';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ATTENDANCE_ROUTES } from './attendance.routes';

describe('Attendance routes', () => {
  it('renders the employee workspace activation journey at /monitoring', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(ATTENDANCE_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PermissionService,
          useValue: {
            hasAnyPermission: (permissions: readonly string[]) => permissions.includes('attendance:read-own'),
            hasAnyModule: (modules: readonly string[]) => modules.includes('time_attendance')
          }
        }
      ]
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/monitoring', ConnectDeviceComponent);

    expect(harness.routeNativeElement?.querySelector('[data-testid="workspace-activation"]')).toBeTruthy();
  });
});

describe('ATTENDANCE_ROUTES', () => {
  const timeTracking = () => ATTENDANCE_ROUTES.find((route) => route.path === 'time-tracking')!;
  const approvals = () => ATTENDANCE_ROUTES.find((route) => route.path === 'corrections/approvals')!;
  const workAreaApprovals = () => ATTENDANCE_ROUTES.find((route) => route.path === 'work-area-change-requests/approvals')!;

  it('guards time tracking with time_attendance and the established any-of permission set, including attendance:approve', () => {
    const route = timeTracking();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual([
      'attendance:read-own',
      'attendance:write-own',
      'attendance:read',
      'attendance:approve'
    ]);
    expect(route.data?.['roles']).toBeUndefined();
  });

  it('routes correction approvals through the legacy redirect with time_attendance and attendance:approve only', () => {
    const route = approvals();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual(['attendance:approve']);
    expect(route.data?.['approvalType']).toBe('corrections');
    expect(route.data?.['roles']).toBeUndefined();
    expect(route.loadComponent).toBeTypeOf('function');
  });

  it('routes Work Area approvals through the legacy redirect with time_attendance and attendance:approve only', () => {
    const route = workAreaApprovals();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual(['attendance:approve']);
    expect(route.data?.['approvalType']).toBe('work-area');
    expect(route.data?.['roles']).toBeUndefined();
    expect(route.loadComponent).toBeTypeOf('function');
  });

  it('keeps the protected destination lazy-loaded and does not bypass it through redirects', () => {
    const route = timeTracking();
    const approvalRoute = approvals();
    const workAreaRoute = workAreaApprovals();
    const root = ATTENDANCE_ROUTES.find((candidate) => candidate.path === '');

    expect(route.loadComponent).toBeTypeOf('function');
    expect(approvalRoute.loadComponent).toBeTypeOf('function');
    expect(root?.redirectTo).toBe('time-tracking');
    expect(root?.pathMatch).toBe('full');
    for (const candidate of [route, approvalRoute, workAreaRoute]) {
      expect(candidate.canActivate?.includes(permissionGuard)).toBe(true);
    }
  });
});
