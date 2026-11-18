import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';
import { MANAGES_PEOPLE, PermissionService } from './core/auth/state/permission.service';
import { canAccessNavItem } from './layouts/main-layout/nav/nav-access';


const loadPlaceholder = () =>
  import('./shared/feature/placeholder-page/placeholder-page.component').then((module) => module.PlaceholderPageComponent);


/** One loader for /calendar and /planner, so both are the same lazy chunk. */
const loadCalendarRoutes = () => import('./modules/calendar/calendar.routes').then((module) => module.CALENDAR_ROUTES);

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
        path: 'dashboard/insights',
        loadComponent: () =>
          import('./modules/dashboard/feature/my-insights-page/my-insights-page.component').then(
            (module) => module.MyInsightsPageComponent
          )
      },
      {
        path: 'dashboard/my-team',
        loadComponent: () =>
          import('./modules/dashboard/feature/my-team-page/my-team-page.component').then(
            (module) => module.MyTeamPageComponent
          )
      },
      {
        path: 'dashboard/activity-timeline',
        loadComponent: () =>
          import('./modules/dashboard/feature/activity-timeline-page/activity-timeline-page.component').then(
            (module) => module.ActivityTimelinePageComponent
          )
      },
      {
        path: 'work',
        canActivate: [permissionGuard],
        data: { modules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
        loadChildren: () => import('./modules/work/work.routes').then((module) => module.WORK_ROUTES)
      },
      {
        path: 'inbox',
        canActivate: [permissionGuard],
        loadChildren: () => import('./modules/inbox/inbox.routes').then((module) => module.INBOX_ROUTES)
      },
      {
        path: 'people',
        canActivate: [permissionGuard],
        data: { permissions: [MANAGES_PEOPLE, 'employees:write', 'employees:offboard', 'checklists:manage'], modules: ['core_hr'] },
        loadChildren: () => import('./modules/people/people.routes').then((module) => module.PEOPLE_ROUTES)
      },
      {
        path: 'calendar',
        canActivate: [permissionGuard],
        data: { permissions: ['calendar:read'], modules: ['calendar'] },
        loadChildren: loadCalendarRoutes
      },
      {
        // Planner = Calendar (2026-10-27 design): the calendar page is the planner; the nav calls it Planner when it is on.
        path: 'planner',
        canActivate: [permissionGuard],
        data: { permissions: ['calendar:read'], modules: ['calendar'] },
        loadChildren: loadCalendarRoutes
      },
      {
        path: 'time-off',
        canActivate: [permissionGuard],
        data: { permissions: ['leave:read-own', 'leave:read-team', 'leave:read', 'leave:manage', 'leave:approve', 'calendar:read'], modules: ['leave'] },
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
        redirectTo: 'attendance'
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
            data: { title: 'General Settings', permissions: ['legal_entity:read', 'legal_entity:update'] }
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
            path: 'users',
            loadComponent: () =>
              import('./modules/settings/feature/users/users.component').then((m) => m.UsersComponent),
            canActivate: [permissionGuard],
            data: { title: 'Users', permissions: ['users:read', 'users:manage'] }
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('./modules/settings/feature/notification-settings/notification-settings.component').then(
                (m) => m.NotificationSettingsComponent
              ),
            canActivate: [permissionGuard],
            canDeactivate: [unsavedChangesGuard],
            data: { title: 'Notification Settings', permissions: ['notifications:manage'] }
          },
          {
            // The leave admin screens (types, policies, entitlements, holidays, all requests) - not part of the Time Off hub.
            path: 'time-off',
            canActivate: [permissionGuard],
            data: { permissions: ['leave:read', 'leave:manage'], modules: ['leave'] },
            loadChildren: () =>
              import('./modules/leave/time-off-settings.routes').then((module) => module.TIME_OFF_SETTINGS_ROUTES)
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
          {
            // Moved here from the Attendance sub-sidebar (2026-11-04): Attendance is a single page now.
            path: 'monitoring',
            loadComponent: () =>
              import('./modules/attendance/feature/monitoring/monitoring.component').then((m) => m.MonitoringComponent),
            canActivate: [permissionGuard],
            data: { title: 'Monitoring', permissions: ['monitoring:read'], modules: ['time_attendance'] }
          },
          {
            path: 'calendar-connections',
            loadComponent: () =>
              import('./modules/settings/feature/calendar-connections/calendar-connections.component').then(
                (m) => m.CalendarConnectionsComponent
              ),
            canActivate: [permissionGuard],
            data: { title: 'Calendar Sync', permissions: ['calendar:read'], modules: ['calendar'] }
          },
          {
            // /settings has no permission of its own - it's reachable if ANY child page is
            // (nav-access.ts "Part 2A" design), so a static redirectTo: 'general' sent every
            // such user to General Settings first regardless of which child actually let them
            // in - a user who only qualifies via, say, Calendar Sync would land here, fail its
            // legal_entity:update guard, and bounce straight to /dashboard even though the
            // sidebar correctly showed them a Settings page they could open. Land on the first
            // child NAV_ITEMS says this user can actually reach, in the same order the sidebar
            // uses, instead of hardcoding one page.
            // NAV_ITEMS is imported on demand: a static import puts the whole sidebar menu in the
            // initial bundle (500 kB budget) just for this redirect.
            path: '',
            pathMatch: 'full',
            redirectTo: async () => {
              const permissionService = inject(PermissionService); // before the await: inject() needs the injection context
              const { NAV_ITEMS } = await import('./layouts/main-layout/nav/nav-items.config');
              const settings = NAV_ITEMS.find((item) => item.id === 'settings');
              const firstReachable = settings?.children?.find((child) => canAccessNavItem(child, permissionService));
              return firstReachable?.path ?? '/dashboard';
            }
          }
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
          import('./core/auth/feature/login/login.component').then((module) => module.LoginComponent),
        canActivate: [redirectIfAuthenticatedGuard]
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
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./core/auth/feature/forgot-password/forgot-password.component').then(
            (module) => module.ForgotPasswordComponent
          )
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./core/auth/feature/reset-password/reset-password.component').then(
            (module) => module.ResetPasswordComponent
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
