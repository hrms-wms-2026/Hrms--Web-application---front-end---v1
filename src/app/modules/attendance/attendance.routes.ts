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

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'overview',
    canActivate: [permissionGuard],
    data: {
      title: 'Overview',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/overview/overview.component').then(
        (module) => module.OverviewComponent
      )
  },

  {
    path: 'monitoring',
    canActivate: [permissionGuard],
    data: {
      title: 'Monitoring',
      permissions: ['monitoring:read'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/monitoring/monitoring.component').then(
        (module) => module.MonitoringComponent
      )
  },

  {
    path: 'time-tracking',
    canActivate: [attendanceApprovalsDeepLinkGuard, permissionGuard],
    data: {
      title: 'Time Tracking',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/time-tracking/time-tracking.component').then(
        (module) => module.TimeTrackingComponent
      )
  },
  {
    // Same component as 'time-tracking' - Requests has no standalone page yet (its
    // correction/work-area draft-form state still lives on TimeTrackingComponent itself, see
    // docs/superpowers/plans/2026-09-08-attendance-overview-redesign.md, "Deferred"). This
    // route exists only so the "Requests" nav item has a URL distinct from "Time Tracking" -
    // reusing that exact path made both sidebar entries highlight together (routerLinkActive
    // compares each link's own target against the current URL, so two links pointing at the
    // identical string both light up regardless of `exact`).
    path: 'time-tracking/requests',
    canActivate: [permissionGuard],
    data: {
      title: 'Requests',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/time-tracking/time-tracking.component').then(
        (module) => module.TimeTrackingComponent
      )
  },
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
  { path: 'work-area-change-requests/approvals', redirectTo: legacyApprovalsRedirect('work_mode_change') },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  }
];
