import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';

const loadPlaceholder = () =>
  import('./shared/feature/placeholder-page/placeholder-page.component').then((module) => module.PlaceholderPageComponent);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./modules/public/feature/landing-page/landing-page.component').then(
        (module) => module.LandingPageComponent
      ),
    canActivate: [redirectIfAuthenticatedGuard]
  },
  {
    path: 'book-a-demo',
    loadComponent: loadPlaceholder,
    data: { title: 'Book a demo' }
  },
  {
    path: 'legal/terms',
    loadComponent: loadPlaceholder,
    data: { title: 'Terms & Conditions' }
  },
  {
    path: 'legal/privacy',
    loadComponent: loadPlaceholder,
    data: { title: 'Privacy Notice' }
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(
        (module) => module.MainLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/feature/dashboard-home/dashboard-home.component').then(
            (module) => module.DashboardHomeComponent
          )
      },
      {
        path: 'work',
        canActivate: [permissionGuard],
        data: { permissions: ['projects:access'] },
        loadChildren: () => import('./modules/work/work.routes').then((module) => module.WORK_ROUTES)
      },
      { path: 'people', loadComponent: loadPlaceholder, data: { title: 'People' } },
      { path: 'calendar', loadComponent: loadPlaceholder, data: { title: 'Calendar' } },
      { path: 'time-off', loadComponent: loadPlaceholder, data: { title: 'Time Off' } },
      { path: 'time-attendance', loadComponent: loadPlaceholder, data: { title: 'Time & Attendance' } },
      {
        path: 'organization',
        canActivate: [permissionGuard],
        data: { permissions: ['org:read', 'org:manage'], modules: ['org_structure'] },
        loadChildren: () =>
          import('./modules/organization/organization.routes').then((module) => module.ORGANIZATION_ROUTES)
      },
      {
        path: 'settings',
        children: [
          {
            path: 'general',
            loadComponent: () =>
              import('./modules/organization/feature/general-settings/general-settings.component').then(
                (module) => module.GeneralSettingsComponent
              ),
            canActivate: [permissionGuard],
            data: { title: 'General Settings', permissions: ['legal_entity:update'] }
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./modules/organization/feature/roles-management/roles-management.component').then(
                (m) => m.RolesManagementComponent
              ),
            canActivate: [permissionGuard],
            data: { title: 'Roles & Permissions', permissions: ['roles:read'] }
          },
          {
            path: 'notifications',
            loadComponent: loadPlaceholder,
            canActivate: [permissionGuard],
            data: { title: 'Notification Settings', permissions: ['notifications:manage'] }
          },
          { path: '', pathMatch: 'full', redirectTo: 'general' }
        ]
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        (module) => module.AuthLayoutComponent
      ),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./core/auth/feature/login/login.component').then((module) => module.LoginComponent)
      },
      {
        path: 'legal-consent',
        loadComponent: () =>
          import('./core/auth/feature/legal-consent/legal-consent.component').then(
            (module) => module.LegalConsentComponent
          )
      },
      {
        path: 'continue',
        loadComponent: () =>
          import('./core/auth/feature/session-exchange/session-exchange.component').then(
            (module) => module.SessionExchangeComponent
          )
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
