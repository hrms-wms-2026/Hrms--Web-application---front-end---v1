import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { PermissionService } from '../../core/auth/state/permission.service';
import { TIME_OFF_SETTINGS_TABS } from './ui/time-off-settings-tabs/time-off-settings-tabs.component';

/**
 * /settings/time-off opens the first tab the caller may see. A guard, not a redirectTo: redirects run
 * before authGuard has loaded the permissions on a fresh page load, guards run after it.
 */
export const firstTimeOffSettingsTab: CanActivateFn = () => {
  const permissions = inject(PermissionService);
  const tab = TIME_OFF_SETTINGS_TABS.find((candidate) => permissions.hasAnyPermission(candidate.permissions));
  return inject(Router).createUrlTree(tab ? ['/settings/time-off', tab.path] : ['/time-off']);
};

const permissionsFor = (path: string): readonly string[] =>
  TIME_OFF_SETTINGS_TABS.find((tab) => tab.path === path)?.permissions ?? [];

/** Settings → Time Off: the leave admin screens, one tab each (TimeOffSettingsTabsComponent). */
export const TIME_OFF_SETTINGS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [firstTimeOffSettingsTab], children: [] },
  {
    path: 'types',
    loadComponent: () => import('./feature/leave-types-management/leave-types-management.component').then((m) => m.LeaveTypesManagementComponent),
    canActivate: [permissionGuard],
    data: { title: 'Leave Types', permissions: permissionsFor('types') }
  },
  {
    path: 'policies',
    loadComponent: () => import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent),
    canActivate: [permissionGuard],
    data: { title: 'Leave Policies', permissions: permissionsFor('policies') }
  },
  {
    path: 'entitlements',
    loadComponent: () => import('./feature/entitlements-management/entitlements-management.component').then((m) => m.EntitlementsManagementComponent),
    canActivate: [permissionGuard],
    data: { title: 'Entitlements', permissions: permissionsFor('entitlements') }
  },
  {
    path: 'holidays',
    loadComponent: () => import('./feature/holidays-management/holidays-management.component').then((m) => m.HolidaysManagementComponent),
    canActivate: [permissionGuard],
    data: { title: 'Holidays', permissions: permissionsFor('holidays') }
  },
  {
    path: 'requests',
    loadComponent: () => import('./feature/requests-list/requests-list.component').then((m) => m.RequestsListComponent),
    canActivate: [permissionGuard],
    data: { title: 'All Requests', permissions: permissionsFor('requests') }
  }
];
