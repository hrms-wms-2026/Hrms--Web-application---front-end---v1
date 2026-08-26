import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'time-tracking',
    loadComponent: () =>
      import('./feature/time-tracking/time-tracking.component').then(
        (module) => module.TimeTrackingComponent
      ),
    data: { title: 'Time Tracking' }
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
