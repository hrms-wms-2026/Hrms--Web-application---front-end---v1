import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ATTENDANCE_ROUTES, attendanceApprovalsDeepLinkGuard } from './attendance.routes';

describe('ATTENDANCE_ROUTES', () => {
  const page = () => ATTENDANCE_ROUTES.find((route) => route.path === '')!;

  it('serves Attendance as one lazy-loaded page at the empty path, gated on time_attendance and any attendance permission', () => {
    const route = page();

    expect(route.pathMatch).toBe('full');
    expect(route.redirectTo).toBeUndefined();
    expect(route.loadComponent).toBeTypeOf('function');
    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual([
      'attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'
    ]);
    expect(route.data?.['roles']).toBeUndefined();
  });

  it('redirects the old Overview, Time Tracking and Requests URLs to the page, and Monitoring to Settings', () => {
    const redirectFor = (path: string) => ATTENDANCE_ROUTES.find((route) => route.path === path)?.redirectTo;

    expect(redirectFor('overview')).toBe('/attendance');
    expect(redirectFor('time-tracking')).toBe('/attendance');
    expect(redirectFor('time-tracking/requests')).toBe('/attendance');
    expect(redirectFor('monitoring')).toBe('/settings/monitoring');
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
      expect(page().canActivate?.[0]).toBe(attendanceApprovalsDeepLinkGuard);
      expect(url(guard({ view: 'team', type: 'corrections' }))).toBe('/inbox?source=attendance&kind=correction');
      expect(url(guard({ view: 'team', type: 'location', requestId: 'l1' }))).toBe('/inbox/attendance/location_change/l1');
      expect(url(guard({ view: 'team', type: 'device-change', requestId: 'd1' }))).toBe('/inbox/attendance/device_change/d1');
      expect(url(guard({ view: 'team', type: 'work-area' }))).toBe('/inbox?source=attendance&kind=work_mode_change');
      expect(guard({ view: 'team', employeeId: 'e1' })).toBe(true);
      expect(guard({})).toBe(true);
    });
  });
});
