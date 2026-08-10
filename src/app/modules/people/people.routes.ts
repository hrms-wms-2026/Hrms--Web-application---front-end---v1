import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'employees'
  },
  {
    path: 'employees',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./feature/employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
        canActivate: [permissionGuard],
        data: { title: 'Employees', permissions: ['employees:read'] }
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./feature/add-employee-wizard/add-employee-wizard.component').then(
            (m) => m.AddEmployeeWizardComponent
          ),
        canActivate: [permissionGuard],
        data: { title: 'Add Employee', permissions: ['employees:write'] }
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./feature/employee-detail/employee-detail.component').then((m) => m.EmployeeDetailComponent),
        canActivate: [permissionGuard],
        data: { title: 'Employee Detail', permissions: ['employees:read'] }
      }
    ]
  }
];
