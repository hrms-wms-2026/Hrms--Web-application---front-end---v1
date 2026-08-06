import { Routes } from '@angular/router';

export const ORGANIZATION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'departments'
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./feature/departments-placeholder/departments-placeholder.component').then(
        (m) => m.DepartmentsPlaceholderComponent
      ),
    data: { title: 'Departments' }
  },
  {
    path: 'positions',
    loadComponent: () =>
      import('./feature/positions-placeholder/positions-placeholder.component').then(
        (m) => m.PositionsPlaceholderComponent
      ),
    data: { title: 'Positions' }
  }
];
