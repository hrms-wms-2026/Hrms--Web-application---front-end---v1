import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ATTENDANCE_ROUTES, attendanceApprovalsDeepLinkGuard } from './attendance.routes';

describe('ATTENDANCE_ROUTES', () => {
    const monitoring = () => ATTENDANCE_ROUTES.find((route) => route.path === 'monitoring')!;
  const timeTracking = () => ATTENDANCE_ROUTES.find((route) => route.path === 'time-tracking')!;
  const requests = () => ATTENDANCE_ROUTES.find((route) => route.path === 'time-tracking/requests')!;

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

  it('keeps the protected destination lazy-loaded and does not bypass it through redirects', () => {
    const route = timeTracking();
    const monitoringRoute = monitoring();
    const root = ATTENDANCE_ROUTES.find((candidate) => candidate.path === '');

    expect(route.loadComponent).toBeTypeOf('function');
    expect(monitoringRoute.loadComponent).toBeTypeOf('function');
    expect(root?.redirectTo).toBe('overview');
    expect(root?.pathMatch).toBe('full');
    for (const candidate of [route, monitoringRoute]) {
      expect(candidate.canActivate?.includes(permissionGuard)).toBe(true);
    }
  });

  describe('approver screens moved to the Inbox (FA)', () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
    const url = (tree: unknown) => TestBed.inject(Router).serializeUrl(tree as UrlTree);
    const redirectOf = (path: string, queryParams: Record<string, string>) => TestBed.runInInjectionContext(() =>
      url((ATTENDANCE_ROUTES.find((r) => r.path === path)!.redirectTo as (r: unknown) => UrlTree)({ queryParams, params: {}, data: {}, url: [], fragment: null })));
    const guard = (queryParams: Record<string, string>) => TestBed.runInInjectionContext(() =>
      attendanceApprovalsDeepLinkGuard({ queryParamMap: convertToParamMap(queryParams) } as never, {} as never));

    it('redirects the legacy correction and work-area approval URLs to the Inbox list or the one request', () => {
      expect(redirectOf('corrections/approvals', {})).toBe('/inbox?source=attendance&kind=correction');
      expect(redirectOf('corrections/approvals', { requestId: 'c1' })).toBe('/inbox/attendance/correction/c1');
      expect(redirectOf('work-area-change-requests/approvals', { requestId: 'w1' })).toBe('/inbox/attendance/work_mode_change/w1');
    });

    it('redirects the old Alerts page to monitoring cases in the Inbox, or the one case for ?alertId=', () => {
      expect(redirectOf('alerts', {})).toBe('/inbox?source=monitoring&tab=alerts');
      expect(redirectOf('alerts', { alertId: 'x1' })).toBe('/inbox/monitoring/exception_case/x1');
    });

    it('sends the old Time Tracking team approvals view to the Inbox, and leaves every other view alone', () => {
      expect(timeTracking().canActivate?.[0]).toBe(attendanceApprovalsDeepLinkGuard);
      expect(url(guard({ view: 'team', type: 'corrections' }))).toBe('/inbox?source=attendance&kind=correction');
      expect(url(guard({ view: 'team', type: 'location', requestId: 'l1' }))).toBe('/inbox/attendance/location_change/l1');
      expect(url(guard({ view: 'team', type: 'device-change', requestId: 'd1' }))).toBe('/inbox/attendance/device_change/d1');
      expect(url(guard({ view: 'team', type: 'work-area' }))).toBe('/inbox?source=attendance&kind=work_mode_change');
      expect(guard({ view: 'team', employeeId: 'e1' })).toBe(true);
      expect(guard({})).toBe(true);
    });
  });
});
