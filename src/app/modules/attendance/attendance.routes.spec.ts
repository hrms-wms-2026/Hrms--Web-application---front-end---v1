import { permissionGuard } from '../../core/guards/permission.guard';
import { ATTENDANCE_ROUTES } from './attendance.routes';

describe('ATTENDANCE_ROUTES', () => {
    const monitoring = () => ATTENDANCE_ROUTES.find((route) => route.path === 'monitoring')!;
  const timeTracking = () => ATTENDANCE_ROUTES.find((route) => route.path === 'time-tracking')!;
  const requests = () => ATTENDANCE_ROUTES.find((route) => route.path === 'time-tracking/requests')!;

  const approvals = () => ATTENDANCE_ROUTES.find((route) => route.path === 'corrections/approvals')!;
  const workAreaApprovals = () => ATTENDANCE_ROUTES.find((route) => route.path === 'work-area-change-requests/approvals')!;

    it('redirects the empty path to overview', () => {
    const emptyRoute = ATTENDANCE_ROUTES.find((route) => route.path === '');
    expect(emptyRoute?.redirectTo).toBe('overview');
  });

  it('registers the overview route with the correct permissions and module gate', () => {
    const overviewRoute = ATTENDANCE_ROUTES.find((route) => route.path === 'overview');
    expect(overviewRoute).toBeDefined();
    expect(overviewRoute?.data?.['modules']).toEqual(['time_attendance']);
    expect(overviewRoute?.data?.['permissions']).toEqual([
      'attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'
    ]);
  });

  it('guards Monitoring with time_attendance and monitoring:read', () => {
    const route = monitoring();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual(['monitoring:read']);
    expect(route.loadComponent).toBeTypeOf('function');
  });

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

  it('gives Requests its own path so it does not co-highlight with Time Tracking, but renders the same component', () => {
    const route = requests();
    const trackingRoute = timeTracking();

    expect(route).toBeDefined();
    expect(route.path).not.toBe(trackingRoute.path);
    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.loadComponent).toBeTypeOf('function');
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
    const monitoringRoute = monitoring();
    const approvalRoute = approvals();
    const workAreaRoute = workAreaApprovals();
    const root = ATTENDANCE_ROUTES.find((candidate) => candidate.path === '');

    expect(route.loadComponent).toBeTypeOf('function');
    expect(monitoringRoute.loadComponent).toBeTypeOf('function');
    expect(approvalRoute.loadComponent).toBeTypeOf('function');
    expect(root?.redirectTo).toBe('overview');
    expect(root?.pathMatch).toBe('full');
    for (const candidate of [route, monitoringRoute, approvalRoute, workAreaRoute]) {
      expect(candidate.canActivate?.includes(permissionGuard)).toBe(true);
    }
  });
});
