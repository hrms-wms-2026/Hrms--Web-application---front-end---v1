import { Routes } from '@angular/router';

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
    path: '',
    pathMatch: 'full',
    redirectTo: 'time-tracking'
  }
];
