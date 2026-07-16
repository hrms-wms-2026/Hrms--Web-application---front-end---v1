import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(
        (module) => module.MainLayoutComponent
      ),
    children: [],
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        (module) => module.AuthLayoutComponent
      ),
    children: [],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
