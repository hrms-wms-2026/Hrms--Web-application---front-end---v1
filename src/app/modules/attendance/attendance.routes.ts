import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router, Routes, UrlTree } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

/** The old Time Tracking approval tabs (?type=) and their inbox kinds. */
const APPROVAL_KINDS: Record<string, string> = {
  corrections: 'correction', 'work-area': 'work_mode_change', location: 'location_change', 'device-change': 'device_change'
};

/** Attendance requests are reviewed in the Inbox: the filtered list, or the one request. */
function inboxFor(kind: string, requestId: string | null | undefined): UrlTree {
  const router = inject(Router);
  return requestId
    ? router.createUrlTree(['/inbox', 'attendance', kind, requestId])
    : router.createUrlTree(['/inbox'], { queryParams: { source: 'attendance', kind } });
}

/** Old deep links into the Time Tracking team approvals (?view=team&type=…&requestId=…) open the Inbox instead. */
export const attendanceApprovalsDeepLinkGuard: CanActivateFn = (route) => {
  const kind = APPROVAL_KINDS[route.queryParamMap.get('type') ?? ''];
  return route.queryParamMap.get('view') === 'team' && kind ? inboxFor(kind, route.queryParamMap.get('requestId')) : true;
};

const legacyApprovalsRedirect = (kind: string): RedirectFunction => ({ queryParams }) => inboxFor(kind, queryParams['requestId']);

const ATTENDANCE_PERMISSIONS = ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'];

// Attendance is one page (2026-11-04): the old Overview and Time Tracking screens were merged into it, and
// Monitoring moved to Settings > Monitoring. The old URLs redirect here; string redirects keep their query params.
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [attendanceApprovalsDeepLinkGuard, permissionGuard],
    data: { title: 'Attendance', permissions: ATTENDANCE_PERMISSIONS, modules: ['time_attendance'] },
    loadComponent: () =>
      import('./feature/time-tracking/time-tracking.component').then((module) => module.TimeTrackingComponent)
  },
  { path: 'overview', pathMatch: 'full', redirectTo: '/attendance' },
  { path: 'time-tracking', pathMatch: 'full', redirectTo: '/attendance' },
  { path: 'time-tracking/requests', pathMatch: 'full', redirectTo: '/attendance' },
  { path: 'monitoring', pathMatch: 'full', redirectTo: '/settings/monitoring' },
  // Exception cases are reviewed in the Inbox now; the old Alerts page (and its ?alertId= links) land there.
  {
    path: 'alerts',
    redirectTo: ({ queryParams }) => {
      const router = inject(Router);
      const alertId = queryParams['alertId'];
      return alertId
        ? router.createUrlTree(['/inbox', 'monitoring', 'exception_case', alertId])
        : router.createUrlTree(['/inbox'], { queryParams: { source: 'monitoring', tab: 'alerts' } });
    }
  },
  { path: 'corrections/approvals', redirectTo: legacyApprovalsRedirect('correction') },
  { path: 'work-area-change-requests/approvals', redirectTo: legacyApprovalsRedirect('work_mode_change') }
];
