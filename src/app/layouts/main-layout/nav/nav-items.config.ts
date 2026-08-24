import { NavItem } from './nav-item.model';

/**
 * Module keys below are literal active_modules entries as actually persisted in
 * subscription_plans.included_modules_json (confirmed in the newest migration,
 * UpdateStarterPlanToCanonicalPhase1Modules.cs) - NOT the separate, differently-named
 * module_catalog.module_key admin catalog (which uses e.g. "org"/"time_off"/
 * "work_management" for the same concepts). The two schemes disagree in this backend;
 * active_modules on /auth/me is sourced from the subscription JSON, so that's the one
 * that matters for nav gating. See FRONTEND_PART2A_..._REPORT.md for the full trail.
 *
 * Permission strings are backend permission codes only (never role names), taken from
 * PermissionSeeder.cs's ModulePermissionOwnership seed.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    path: '/dashboard'
  },
  {
    id: 'work',
    label: 'Work',
    icon: 'work',
    path: '/work',
    requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'],
    requiredPermissions: ['projects:access']
  },
  {
    id: 'people',
    label: 'People',
    icon: 'people',
    path: '/people',
    requiredModules: ['core_hr'],
    children: [
      {
        id: 'people-employees',
        label: 'Employees',
        path: '/people/employees',
        requiredModules: ['core_hr']
      },
      {
        id: 'people-checklists',
        label: 'Checklists',
        path: '/people/checklists',
        requiredModules: ['core_hr'],
        requiredPermissions: ['employees:read']
      },
      {
        id: 'people-offboarding',
        label: 'Offboarding',
        path: '/people/offboarding',
        requiredModules: ['core_hr'],
        requiredPermissions: ['employees:read']
      },
      {
        id: 'people-approvals',
        label: 'Approvals',
        path: '/people/approvals',
        requiredModules: ['core_hr'],
        requiredPermissions: ['roles:manage']
      }
    ]
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'calendar',
    path: '/calendar',
    requiredModules: ['calendar']
  },
  {
    id: 'time-off',
    label: 'Time Off',
    icon: 'time-off',
    path: '/time-off',
    requiredModules: ['leave']
  },
  {
    id: 'time-attendance',
    label: 'Attendance',
    icon: 'time-attendance',
    path: '/attendance/time-tracking',
    requiredModules: ['time_attendance'],
    requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read']
  },
  {
    id: 'organization',
    label: 'Org',
    icon: 'organization',
    path: '/organization',
    requiredModules: ['org_structure'],
    requiredPermissions: ['org:read'],
    children: [
      {
        id: 'organization-departments',
        label: 'Departments',
        path: '/organization/departments',
        requiredModules: ['org_structure'],
        requiredPermissions: ['org:read']
      },
      {
        id: 'organization-positions',
        label: 'Positions',
        path: '/organization/positions',
        requiredModules: ['org_structure'],
        requiredPermissions: ['org:read']
      }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/settings',
    // No module/permission gate of its own - visible purely from child visibility
    // (canAccessNavItem) so it stays extensible as more Settings sub-items ship.
    children: [
      {
        id: 'settings-general',
        label: 'General Settings',
        path: '/settings/general',
        // GetGeneralSettings/UpdateGeneralSettings on LegalEntitiesController both require
        // legal_entity:update (not org:manage) - see PermissionSeeder.cs.
        requiredPermissions: ['legal_entity:update']
      },
      {
        id: 'settings-roles',
        label: 'Roles & Permissions',
        path: '/settings/roles',
        requiredPermissions: ['roles:manage']
      },
      {
        id: 'settings-notifications',
        label: 'Notification Settings',
        path: '/settings/notifications',
        requiredPermissions: ['notifications:manage']
      },
      {
        id: 'settings-bulk-onboarding',
        label: 'Bulk Onboarding',
        path: '/settings/bulk-onboarding',
        requiredModules: ['core_hr'],
        requiredPermissions: ['employees:write']
      },
      {
        id: 'settings-clock-in-policy',
        label: 'Clock-in Policy',
        path: '/settings/clock-in-policy',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read']
      }
      // Devices & connections and Audit log are intentionally not listed yet.
    ]
  }
];
