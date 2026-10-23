import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

/** The old approver screen lives in the Inbox now: the list of leave requests, or the one request (?requestId=). */
export const teamApprovalsRedirect: RedirectFunction = ({ queryParams }) => {
  const router = inject(Router);
  const requestId = queryParams['requestId'];
  return requestId
    ? router.createUrlTree(['/inbox', 'leave', 'request', requestId])
    : router.createUrlTree(['/inbox'], { queryParams: { source: 'leave', tab: 'requests' } });
};
export const LEAVE_ROUTES: Routes = [{ path: '', loadComponent: () => import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent), children: [{ path: '', loadComponent: () => import('./feature/my-balances/my-balances.component').then((m) => m.MyBalancesComponent), canActivate: [permissionGuard], data: { title: 'Balances', permissions: ['leave:read-own', 'leave:read-team'] } }, { path: 'team', loadComponent: () => import('./feature/team-balances/team-balances.component').then((m) => m.TeamBalancesComponent), canActivate: [permissionGuard], data: { title: 'Balances', permissions: ['leave:read-team'] } }, { path: 'entitlements', loadComponent: () => import('./feature/entitlements-management/entitlements-management.component').then((m) => m.EntitlementsManagementComponent), canActivate: [permissionGuard], data: { title: 'Entitlements', permissions: ['leave:read', 'leave:manage'] } }, { path: 'types', loadComponent: () => import('./feature/leave-types-management/leave-types-management.component').then((m) => m.LeaveTypesManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Types', permissions: ['leave:read'] } }, { path: 'policies', loadComponent: () => import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Policies', permissions: ['leave:manage'] } }, { path: 'team-approvals', redirectTo: teamApprovalsRedirect }, { path: 'all', loadComponent: () => import('./feature/requests-list/requests-list.component').then((m) => m.RequestsListComponent), canActivate: [permissionGuard], data: { title: 'All Requests', permissions: ['leave:read'] } },
{ path: 'calendar', loadComponent: () => import('./feature/team-calendar/team-calendar.component').then((m) => m.TeamCalendarComponent), canActivate: [permissionGuard], data: { title: 'Team Calendar', permissions: ['calendar:read'] } }] }];
