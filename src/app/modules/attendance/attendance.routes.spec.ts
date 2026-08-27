import { permissionGuard } from '../../core/guards/permission.guard';
import { ATTENDANCE_ROUTES } from './attendance.routes';

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
