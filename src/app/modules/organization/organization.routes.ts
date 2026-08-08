import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const ORGANIZATION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'departments'
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./feature/department-management/department-management.component').then(
        (m) => m.DepartmentManagementComponent
      ),
    canActivate: [permissionGuard],
    data: { title: 'Departments', permissions: ['org:read'] }
  },
  {
    path: 'positions',
    loadComponent: () =>
      import('./feature/position-management/position-management.component').then(
        (m) => m.PositionManagementComponent
      ),
    canActivate: [permissionGuard],
    data: { title: 'Positions', permissions: ['org:read'] }
  }
];
