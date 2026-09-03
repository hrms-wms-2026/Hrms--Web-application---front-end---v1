import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const LEAVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent),
    children: [
      { path: '', loadComponent: () => import('./feature/my-balances/my-balances.component').then((m) => m.MyBalancesComponent), canActivate: [permissionGuard], data: { title: 'My Balances', permissions: ['leave:read-own'] } },
      { path: 'team', loadComponent: () => import('./feature/team-hub/team-hub.component').then((m) => m.TeamHubComponent), canActivate: [permissionGuard], data: { title: 'Team', permissions: ['leave:read-team', 'leave:approve', 'leave:read'] } },
      { path: 'entitlements', loadComponent: () => import('./feature/entitlements-management/entitlements-management.component').then((m) => m.EntitlementsManagementComponent), canActivate: [permissionGuard], data: { title: 'Entitlements', permissions: ['leave:read', 'leave:manage'] } },
      { path: 'types', loadComponent: () => import('./feature/leave-types-management/leave-types-management.component').then((m) => m.LeaveTypesManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Types', permissions: ['leave:read'] } },
      { path: 'policies', loadComponent: () => import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Policies', permissions: ['leave:manage'] } },
      { path: 'team-approvals', loadComponent: () => import('./feature/legacy-team-redirect/legacy-team-redirect.component').then((m) => m.LegacyTeamRedirectComponent), canActivate: [permissionGuard], data: { title: 'Pending Approvals', permissions: ['leave:approve'] } },
      { path: 'all', loadComponent: () => import('./feature/legacy-team-redirect/legacy-team-redirect.component').then((m) => m.LegacyTeamRedirectComponent), canActivate: [permissionGuard], data: { title: 'All Requests', permissions: ['leave:read'] } },
      { path: 'calendar', loadComponent: () => import('./feature/team-calendar/team-calendar.component').then((m) => m.TeamCalendarComponent), canActivate: [permissionGuard], data: { title: 'Team Calendar', permissions: ['calendar:read'] } }
    ]
  }
];
