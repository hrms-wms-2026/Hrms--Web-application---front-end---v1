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
      {
        path: 'people',
        canActivate: [permissionGuard],
        data: { permissions: ['employees:read', 'employees:write'], modules: ['core_hr'] },
        loadChildren: () => import('./modules/people/people.routes').then((module) => module.PEOPLE_ROUTES)
      },
      {
        path: 'calendar',
        canActivate: [permissionGuard],
        data: { permissions: ['calendar:read'], modules: ['calendar'] },
        loadChildren: () => import('./modules/calendar/calendar.routes').then((module) => module.CALENDAR_ROUTES)
      },
      {
        path: 'time-off',
        canActivate: [permissionGuard],
        data: { permissions: ['leave:read-own', 'leave:read-team', 'leave:approve', 'leave:read'], modules: ['leave'] },
        loadChildren: () => import('./modules/leave/leave.routes').then((module) => module.LEAVE_ROUTES)
      },
      {
        path: 'attendance',
        canActivate: [permissionGuard],
        data: {
          permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
          modules: ['time_attendance']
        },
        loadChildren: () =>
          import('./modules/attendance/attendance.routes').then((module) => module.ATTENDANCE_ROUTES)
      },
      {
        path: 'time-attendance',
        pathMatch: 'full',
        redirectTo: 'attendance/time-tracking'
      },
      {
        path: 'organization',
        canActivate: [permissionGuard],
        data: { permissions: ['org:read'], modules: ['org_structure'] },
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
          {
            path: 'bulk-onboarding',
            loadComponent: () =>
              import('./modules/people/feature/bulk-onboarding/bulk-onboarding.component').then(
                (m) => m.BulkOnboardingComponent
              ),
            canActivate: [permissionGuard],
            data: { title: 'Bulk Onboarding', permissions: ['employees:write'] }
          },
          {
            path: 'clock-in-policy',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component').then(
                    (m) => m.ClockInPolicyFormComponent
                  ),
                canActivate: [permissionGuard],
                data: {
                  title: 'Clock-in Policy',
                  permissions: ['attendance:read'],
                  modules: ['time_attendance']
                }
              },
              // Legacy create/edit URLs → company-wide settings screen
              { path: 'new', pathMatch: 'full', redirectTo: '' },
              { path: ':id/edit', redirectTo: '' }
            ]
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
      {
        path: 'invitations/:token',
        loadComponent: () =>
          import('./core/auth/feature/accept-invitation/accept-invitation.component').then(
            (module) => module.AcceptInvitationComponent
          )
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  },
  {
    path: 'device/activate',
    loadComponent: () =>
      import('./modules/device-activation/feature/device-activation/device-activation.component').then(
        (module) => module.DeviceActivationComponent
      ),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
