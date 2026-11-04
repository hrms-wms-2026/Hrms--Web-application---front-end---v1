import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { TEAM_AVAILABILITY_PERMISSIONS } from './leave-permissions';

/** The old approver screen lives in the Inbox now: the list of leave requests, or the one request (?requestId=). */
export const teamApprovalsRedirect: RedirectFunction = ({ queryParams }) => {
  const router = inject(Router);
  const requestId = queryParams['requestId'];
  return requestId
    ? router.createUrlTree(['/inbox', 'leave', 'request', requestId])
    : router.createUrlTree(['/inbox'], { queryParams: { source: 'leave', tab: 'requests' } });
};


/**
 * Time Off is one hub (2026-10-29 redesign) with three screens it links to; there is no sub-sidebar.
 * The admin screens moved to Settings → Time Off, so their old URLs redirect there (query params kept).
 */
export const LEAVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent),
    children: [
      { path: '', loadComponent: () => import('./feature/time-off-hub/time-off-hub.component').then((m) => m.TimeOffHubComponent), data: { title: 'Time Off' } },
      {
        path: 'availability',
        loadComponent: () => import('./feature/team-availability/team-availability.component').then((m) => m.TeamAvailabilityComponent),
        canActivate: [permissionGuard],
        data: { title: 'Team Availability', permissions: TEAM_AVAILABILITY_PERMISSIONS }
      },
      {
        path: 'requests',
        loadComponent: () => import('./feature/my-leave-requests/my-leave-requests.component').then((m) => m.MyLeaveRequestsComponent),
        canActivate: [permissionGuard],
        data: { title: 'Leave Requests', permissions: ['leave:read-own'] }
      },
      {
        path: 'leave-types',
        loadComponent: () => import('./feature/my-leave-types/my-leave-types.component').then((m) => m.MyLeaveTypesComponent),
        canActivate: [permissionGuard],
        data: { title: 'All my leave types', permissions: ['leave:read-own'] }
      },
      { path: 'team-approvals', redirectTo: teamApprovalsRedirect },
      { path: 'team', redirectTo: '' },
      { path: 'calendar', redirectTo: 'availability' },
      { path: 'types', redirectTo: '/settings/time-off/types' },
      { path: 'policies', redirectTo: '/settings/time-off/policies' },
      { path: 'entitlements', redirectTo: '/settings/time-off/entitlements' },
      { path: 'all', redirectTo: '/settings/time-off/requests' }
    ]
  }
];
