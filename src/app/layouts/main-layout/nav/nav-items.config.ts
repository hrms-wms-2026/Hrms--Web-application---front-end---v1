import { NavItem } from './nav-item.model';

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/dashboard' },
  { id: 'work', label: 'Work', icon: 'work', path: '/work', requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
  // Requests and alerts across modules. Work is its only source today, so it shares Work's gate;
  // add a module here when another source (Leave, HR) plugs into the inbox router.
  { id: 'inbox', label: 'Inbox', icon: 'inbox', path: '/inbox', requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
  {
    id: 'people', label: 'People', icon: 'people', path: '/people', requiredModules: ['core_hr'],
    children: [
      { id: 'people-employees', label: 'Employees', path: '/people/employees', requiredModules: ['core_hr'], requiredPermissions: ['employees:read', 'employees:write'] },
      { id: 'people-checklists', label: 'Checklists', path: '/people/checklists', requiredModules: ['core_hr'], requiredPermissions: ['employees:read'] },
      { id: 'people-offboarding', label: 'Offboarding', path: '/people/offboarding', requiredModules: ['core_hr'], requiredPermissions: ['employees:read'] },
      { id: 'people-approvals', label: 'Approvals', path: '/people/approvals', requiredModules: ['core_hr'], requiredPermissions: ['roles:manage'] }
    ]
  },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', path: '/calendar', requiredModules: ['calendar'] },
  {
    id: 'time-off', label: 'Time Off', icon: 'time-off', path: '/time-off', requiredModules: ['leave'],
    children: [
      { id: 'time-off-balances', label: 'Balances', path: '/time-off', exact: true, requiredModules: ['leave'], requiredPermissions: ['leave:read-own', 'leave:read-team'] },
      { id: 'time-off-entitlements', label: 'Entitlements', path: '/time-off/entitlements', requiredModules: ['leave'], requiredPermissions: ['leave:read', 'leave:manage'] },
      { id: 'time-off-types', label: 'Leave Types', path: '/time-off/types', requiredModules: ['leave'], requiredPermissions: ['leave:read'] },
      { id: 'time-off-policies', label: 'Leave Policies', path: '/time-off/policies', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
      { id: 'time-off-team-approvals', label: 'Pending Approvals', path: '/time-off/team-approvals', requiredModules: ['leave'], requiredPermissions: ['leave:approve'] },
      { id: 'time-off-all-requests', label: 'All Requests', path: '/time-off/all', requiredModules: ['leave'], requiredPermissions: ['leave:read'] }
    ]
  },
  {
    id: 'time-attendance',
    label: 'Attendance',
    icon: 'time-attendance',
    path: '/attendance/overview',
    requiredModules: ['time_attendance'],
    requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
    children: [
      {
        id: 'time-attendance-overview',
        label: 'Overview',
        path: '/attendance/overview',
        exact: true,
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve']
      },
      {
        id: 'time-attendance-tracking',
        label: 'Time Tracking',
        path: '/attendance/time-tracking',
        exact: true,
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve']
      },
      {
        // Requests has no standalone page yet - the correction/work-area draft-form state it
        // needs still lives on TimeTrackingComponent itself (see
        // docs/superpowers/plans/2026-09-08-attendance-overview-redesign.md, "Deferred"). It
        // renders that same component via a second route (attendance.routes.ts,
        // 'time-tracking/requests') so this has its own URL, distinct from "Time Tracking" -
        // reusing the identical path made both sidebar links highlight together, since
        // routerLinkActive compares each link's own target against the current URL and can't
        // tell two identical targets apart.
        id: 'time-attendance-requests',
        label: 'Requests',
        path: '/attendance/time-tracking/requests',
        exact: true,
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own']
      },
      {
        id: 'time-attendance-alerts',
        label: 'Alerts',
        path: '/attendance/alerts',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:approve', 'employees:write', 'exceptions:view']
      },
      {
        id: 'time-attendance-monitoring',
        label: 'Monitoring',
        path: '/attendance/monitoring',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['monitoring:read']
      }
    ]
  },
  {
    id: 'organization', label: 'Org', icon: 'organization', path: '/organization', requiredModules: ['org_structure'], requiredPermissions: ['org:read'],
    children: [
      { id: 'organization-departments', label: 'Departments', path: '/organization/departments', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] },
      { id: 'organization-positions', label: 'Positions', path: '/organization/positions', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] }
    ]
  },
  {
    id: 'settings', label: 'Settings', icon: 'settings', path: '/settings',
    children: [
      { id: 'settings-general', label: 'General Settings', path: '/settings/general', requiredPermissions: ['legal_entity:update'] },
      { id: 'settings-roles', label: 'Roles & Permissions', path: '/settings/roles', requiredPermissions: ['roles:read', 'roles:manage'] },
      { id: 'settings-notifications', label: 'Notification Settings', path: '/settings/notifications', requiredPermissions: ['notifications:manage'] },
      { id: 'settings-bulk-onboarding', label: 'Bulk Onboarding', path: '/settings/bulk-onboarding', requiredModules: ['core_hr'], requiredPermissions: ['employees:write'] },
      { id: 'settings-clock-in-policy', label: 'Clock-in Policy', path: '/settings/clock-in-policy', requiredModules: ['time_attendance'], requiredPermissions: ['attendance:read'] },
      { id: 'settings-calendar-connections', label: 'Calendar Sync', path: '/settings/calendar-connections', requiredModules: ['calendar'], requiredPermissions: ['calendar:read'] }
      // Audit log is intentionally not listed yet.
    ]
  }
];
