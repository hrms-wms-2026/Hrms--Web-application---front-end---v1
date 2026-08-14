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
  },
  {
    path: 'checklists',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./feature/checklist-templates/checklist-templates.component').then(
            (m) => m.ChecklistTemplatesComponent
          ),
        canActivate: [permissionGuard],
        data: { title: 'Checklists', permissions: ['employees:read'] }
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./feature/checklist-builder/checklist-builder.component').then(
            (m) => m.ChecklistBuilderComponent
          ),
        canActivate: [permissionGuard],
        data: { title: 'Create Checklist', permissions: ['employees:write'] }
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./feature/checklist-builder/checklist-builder.component').then(
            (m) => m.ChecklistBuilderComponent
          ),
        canActivate: [permissionGuard],
        data: { title: 'Edit Checklist', permissions: ['employees:write'] }
      }
    ]
  }
];
