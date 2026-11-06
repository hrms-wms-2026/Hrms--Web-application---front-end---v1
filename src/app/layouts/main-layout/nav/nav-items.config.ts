import { MANAGES_PEOPLE } from '../../../core/auth/state/permission.service';
import { NavItem } from './nav-item.model';

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/dashboard' },
  { id: 'work', label: 'Work', description: 'Projects, tasks and boards.', icon: 'work', path: '/work', requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] },
  // Requests, alerts and investigations from every module (Work, Leave, Attendance, Monitoring, Calendar):
  // shown to every employee - each source decides what the caller sees.
  // Its sub-sidebar is the chat list (people, groups), not child links.
  { id: 'inbox', label: 'Inbox', description: 'Requests, alerts and chats.', icon: 'inbox', path: '/inbox', customSubSidebar: 'inbox' },
  { id: 'calendar', label: 'Calendar', description: 'View and manage your calendar.', icon: 'calendar', path: '/calendar', requiredModules: ['calendar'] },
  // Time Off is one hub page that links to its own screens (2026-10-29 redesign), so it has no sub-sidebar.
  // Its admin screens live under Settings → Time Off.
  { id: 'time-off', label: 'Time Off', description: 'Leaves, holidays and time off.', icon: 'time-off', path: '/time-off', requiredModules: ['leave'],
    requiredPermissions: ['leave:read-own', 'leave:read-team', 'leave:read', 'leave:manage', 'leave:approve', 'calendar:read'] },
  // Attendance is one page (2026-11-04 redesign), so it has no sub-sidebar. Monitoring lives under Settings → Monitoring.
  { id: 'time-attendance', label: 'Attendance', description: 'Attendance and work hours.', icon: 'time-attendance', path: '/attendance',
    requiredModules: ['time_attendance'],
    requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'] },
  // Org holds the organization structure and the people in it, as two sections of one sub-sidebar. The parent needs
  // either module and shows when any child is reachable (a team manager sees only People, an org admin only
  // Organization), and the rail opens the first reachable child (NavigationStateService.entryPath).
  {
    id: 'organization', label: 'Org', menuTitle: 'Organization & People', description: 'Departments, positions and people.', icon: 'organization', path: '/organization', alsoMatches: ['/people'],
    requiredModules: ['org_structure', 'core_hr'],
    children: [
      { id: 'organization-departments', label: 'Departments', description: 'Departments and who heads them.', path: '/organization/departments', section: 'Organization', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] },
      { id: 'organization-positions', label: 'Positions', description: 'Roles, codes and reporting lines.', path: '/organization/positions', section: 'Organization', requiredModules: ['org_structure'], requiredPermissions: ['org:read'] },
      { id: 'people-employees', label: 'Employees', description: 'Everyone in your organization.', path: '/people/employees', section: 'People', requiredModules: ['core_hr'], requiredPermissions: [MANAGES_PEOPLE, 'employees:write'] },
      { id: 'people-checklists', label: 'Checklists', description: 'Onboarding and offboarding task lists.', path: '/people/checklists', section: 'People', requiredModules: ['core_hr'], requiredPermissions: ['employees:write'] },
      { id: 'people-offboarding', label: 'Offboarding', description: 'Employees on their way out.', path: '/people/offboarding', section: 'People', requiredModules: ['core_hr'], requiredPermissions: ['employees:offboard', 'employees:write'] }
    ]
  },
  {
    id: 'settings', label: 'Settings', description: 'Company, roles and preferences.', icon: 'settings', path: '/settings',
    children: [
      { id: 'settings-general', label: 'General Settings', description: 'Company identity, registration and system configuration.', path: '/settings/general', requiredPermissions: ['legal_entity:read', 'legal_entity:update'] },
      { id: 'settings-roles', label: 'Roles & Permissions', description: 'Manage roles, permissions and access control.', path: '/settings/roles', requiredPermissions: ['roles:read', 'roles:manage'] },
      { id: 'settings-users', label: 'Users', description: 'Manage team members and their access.', path: '/settings/users', requiredPermissions: ['users:read', 'users:manage'] },
      { id: 'settings-notifications', label: 'Notification Settings', description: 'Configure email and in-app notifications.', path: '/settings/notifications', requiredPermissions: ['notifications:manage'] },
      { id: 'settings-bulk-onboarding', label: 'Bulk Onboarding', description: 'Add and invite multiple users at once.', path: '/settings/bulk-onboarding', requiredModules: ['core_hr'], requiredPermissions: ['employees:write'] },
      { id: 'settings-time-off', label: 'Time Off', description: 'Leave types, policies, entitlements and holidays.', path: '/settings/time-off', requiredModules: ['leave'], requiredPermissions: ['leave:read', 'leave:manage'] },
      { id: 'settings-clock-in-policy', label: 'Clock-in Policy', description: 'When and where people can clock in.', path: '/settings/clock-in-policy', requiredModules: ['time_attendance'], requiredPermissions: ['attendance:read'] },
      { id: 'settings-monitoring', label: 'Monitoring', description: 'Activity and presence monitoring.', path: '/settings/monitoring', requiredModules: ['time_attendance'], requiredPermissions: ['monitoring:read'] },
      { id: 'settings-calendar-connections', label: 'Calendar Sync', description: 'Connect Outlook and Google calendars.', path: '/settings/calendar-connections', requiredModules: ['calendar'], requiredPermissions: ['calendar:read'] }
      // Audit log is intentionally not listed yet.
    ]
  }
];
