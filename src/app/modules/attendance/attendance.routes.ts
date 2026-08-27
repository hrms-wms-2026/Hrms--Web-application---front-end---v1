import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'time-tracking',
    canActivate: [permissionGuard],
    data: {
      title: 'Time Tracking',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read'],
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
    data: { title: 'Attendance correction approvals', permissions: ['attendance:approve'], modules: ['time_attendance'] },
    loadComponent: () =>
      import('./feature/correction-approvals/correction-approvals.component').then(
        (module) => module.CorrectionApprovalsComponent
      )
  },
  {
    path: 'monitoring',
    canActivate: [permissionGuard],
    loadComponent: () =>
      import('../settings/feature/connect-device/connect-device.component').then(
        (module) => module.ConnectDeviceComponent
      ),
    data: {
      title: 'Monitoring',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read'],
      modules: ['time_attendance']
    }
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'time-tracking'
  }
];
