import { MANAGES_PEOPLE } from '../../../core/auth/state/permission.service';
import { NavItem } from './nav-item.model';

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/dashboard' },
  { id: 'work', label: 'Work', icon: 'work', path: '/work', requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
  // Requests, alerts and investigations from every module (Work, Leave, Attendance, Monitoring, Calendar):
  // shown to every employee - each source decides what the caller sees.
  // Its sub-sidebar is the chat list (people, groups), not child links.
  { id: 'inbox', label: 'Inbox', icon: 'inbox', path: '/inbox', customSubSidebar: 'inbox' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', path: '/calendar', requiredModules: ['calendar'] },
  // Day planner: plans the employee's own tasks, so it follows the Work modules (the API answers 503 while it is off).
  { id: 'planner', label: 'Planner', icon: 'calendar', path: '/planner', requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
  {
    id: 'time-off', label: 'Time Off', icon: 'time-off', path: '/time-off', requiredModules: ['leave'],
    children: [
      { id: 'time-off-balances', label: 'Balances', path: '/time-off', exact: true, requiredModules: ['leave'], requiredPermissions: ['leave:read-own', 'leave:read-team'] },
      { id: 'time-off-entitlements', label: 'Entitlements', path: '/time-off/entitlements', requiredModules: ['leave'], requiredPermissions: ['leave:read', 'leave:manage'] },
      { id: 'time-off-types', label: 'Leave Types', path: '/time-off/types', requiredModules: ['leave'], requiredPermissions: ['leave:read'] },
      { id: 'time-off-policies', label: 'Leave Policies', path: '/time-off/policies', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
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
        id: 'time-attendance-monitoring',
        label: 'Monitoring',
        path: '/attendance/monitoring',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['monitoring:read']
      }
    ]
  },
  // Org holds the organization structure and the people in it, as two sections of one sub-sidebar. The parent needs
  // either module and shows when any child is reachable (a team manager sees only People, an org admin only
  // Organization), and the rail opens the first reachable child (NavigationStateService.entryPath).
  {
    id: 'organization', label: 'Org', icon: 'organization', path: '/organization', alsoMatches: ['/people'],
    requiredModules: ['org_structure', 'core_hr'],
    children: [
      { id: 'organization-departments', label: 'Departments', path: '/organization/departments', section: 'Organization', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] },
      { id: 'organization-positions', label: 'Positions', path: '/organization/positions', section: 'Organization', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] },
      { id: 'people-employees', label: 'Employees', path: '/people/employees', section: 'People', requiredModules: ['core_hr'], requiredPermissions: [MANAGES_PEOPLE, 'employees:write'] },
      { id: 'people-checklists', label: 'Checklists', path: '/people/checklists', section: 'People', requiredModules: ['core_hr'], requiredPermissions: ['employees:write'] },
      { id: 'people-offboarding', label: 'Offboarding', path: '/people/offboarding', section: 'People', requiredModules: ['core_hr'], requiredPermissions: ['employees:offboard', 'employees:write'] }
    ]
  },
  {
    id: 'settings', label: 'Settings', icon: 'settings', path: '/settings',
    children: [
      { id: 'settings-general', label: 'General Settings', path: '/settings/general', requiredPermissions: ['legal_entity:read', 'legal_entity:update'] },
      { id: 'settings-roles', label: 'Roles & Permissions', path: '/settings/roles', requiredPermissions: ['roles:read', 'roles:manage'] },
      { id: 'settings-users', label: 'Users', path: '/settings/users', requiredPermissions: ['users:read', 'users:manage'] },
      { id: 'settings-notifications', label: 'Notification Settings', path: '/settings/notifications', requiredPermissions: ['notifications:manage'] },
      { id: 'settings-bulk-onboarding', label: 'Bulk Onboarding', path: '/settings/bulk-onboarding', requiredModules: ['core_hr'], requiredPermissions: ['employees:write'] },
      { id: 'settings-clock-in-policy', label: 'Clock-in Policy', path: '/settings/clock-in-policy', requiredModules: ['time_attendance'], requiredPermissions: ['attendance:read'] },
      { id: 'settings-calendar-connections', label: 'Calendar Sync', path: '/settings/calendar-connections', requiredModules: ['calendar'], requiredPermissions: ['calendar:read'] }
      // Audit log is intentionally not listed yet.
    ]
  }
];
