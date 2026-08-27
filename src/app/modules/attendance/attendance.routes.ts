import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'time-tracking',
    canActivate: [permissionGuard],
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
    path: 'corrections/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Attendance correction approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'corrections' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
  {
    path: 'work-area-change-requests/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Work-area approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'work-area' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
  {
    path: 'monitoring',
    canActivate: [permissionGuard],
    loadComponent: () =>
      import('../../shared/feature/placeholder-page/placeholder-page.component').then(
        (module) => module.PlaceholderPageComponent
      ),
    data: {
      title: 'Monitoring',
      permissions: ['attendance:read'],
      modules: ['time_attendance']
    }
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'time-tracking'
  }
];
