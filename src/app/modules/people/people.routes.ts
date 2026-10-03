import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'employees'
  },
  {
    path: 'employees',
    canDeactivate: [unsavedChangesGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./feature/employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Employees', permissions: ['employees:read'] }
      },
      {
        path: 'new',
        redirectTo: (redirectData) => {
          const draftId = redirectData.queryParams['draftId'];
          return draftId ? `/people/employees?draftId=${draftId}` : '/people/employees?addEmployee=true';
        }
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./feature/employee-detail/employee-detail.component').then((m) => m.EmployeeDetailComponent),
        canActivate: [permissionGuard],
        data: { title: 'Employee Detail', permissions: ['employees:read'] }
      },
      {
        path: ':id/offboarding',
        loadComponent: () =>
          import('./feature/offboarding/offboarding-wizard.component').then((m) => m.OffboardingWizardComponent),
        canActivate: [permissionGuard],
        data: { title: 'Offboard Employee', permissions: ['employees:offboard'] }
      }
    ]
  },
  {
    path: 'offboarding',
    loadComponent: () =>
      import('./feature/offboarding/offboarding-overview.component').then((m) => m.OffboardingOverviewComponent),
    canActivate: [permissionGuard],
    data: { title: 'Offboarding', permissions: ['employees:read'] }
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
        redirectTo: () => '/people/checklists?create=true',
        pathMatch: 'full'
      },
      {
        path: ':id/edit',
        redirectTo: (route) => `/people/checklists?edit=${route.params['id']}`,
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('./feature/approvals-list/approvals-list.component').then((m) => m.ApprovalsListComponent),
    canActivate: [permissionGuard],
    data: { title: 'Approvals', permissions: ['roles:manage'] }
  },
  {
    path: 'offboarding-approvals',
    loadComponent: () =>
      import('./feature/offboarding/offboarding-approvals.component').then((m) => m.OffboardingApprovalsComponent),
    canActivate: [permissionGuard],
    data: { title: 'Offboarding Approvals', permissions: ['employees:read'] }
  }
];
