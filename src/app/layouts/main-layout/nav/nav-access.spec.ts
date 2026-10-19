import { MANAGES_PEOPLE } from '../../../core/auth/state/permission.service';
import { canAccessNavItem, NavAccessChecker } from './nav-access';
import { NavItem } from './nav-item.model';
import { NAV_ITEMS } from './nav-items.config';

function checker(permissions: string[], modules: string[]): NavAccessChecker {
  return {
    hasAnyModule: (required) => required.some((m) => modules.includes(m)),
    hasAnyPermission: (required) => permissions.includes('*') || required.some((p) => permissions.includes(p))
  };
}

describe('canAccessNavItem', () => {
  it('shows the Inbox to every employee, with no module or permission gate', () => {
    const inbox = NAV_ITEMS.find((i) => i.id === 'inbox')!;
    expect(inbox.requiredModules).toBeUndefined();
    expect(canAccessNavItem(inbox, checker([], []))).toBe(true);
  });

  it('is always visible for a leaf item with no gates (Home)', () => {
    const item: NavItem = { id: 'home', label: 'Home', path: '/dashboard' };
    expect(canAccessNavItem(item, checker([], []))).toBe(true);
  });

  it('gates a module-only leaf item on activeModules (any-of)', () => {
    const item: NavItem = { id: 'people', label: 'People', path: '/people', requiredModules: ['core_hr'] };
    expect(canAccessNavItem(item, checker([], ['core_hr']))).toBe(true);
    expect(canAccessNavItem(item, checker([], ['calendar']))).toBe(false);
  });

  it('requires ALL declared gates on the item itself (module AND permission)', () => {
    const item: NavItem = {
      id: 'organization',
      label: 'Organization',
      path: '/organization',
      requiredModules: ['org_structure'],
      requiredPermissions: ['org:read']
    };
    expect(canAccessNavItem(item, checker(['org:read'], ['org_structure']))).toBe(true);
    expect(canAccessNavItem(item, checker(['org:read'], []))).toBe(false);
    expect(canAccessNavItem(item, checker([], ['org_structure']))).toBe(false);
  });

  it('a parent with children (Settings) is visible if any child is visible, with no gate of its own', () => {
    const settings: NavItem = {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      children: [
        { id: 'settings-general', label: 'General Settings', path: '/settings/general', requiredPermissions: ['org:manage'] },
        { id: 'settings-roles', label: 'Roles & Permissions', path: '/settings/roles', requiredPermissions: ['roles:manage'] }
      ]
    };
    expect(canAccessNavItem(settings, checker(['roles:manage'], []))).toBe(true);
    expect(canAccessNavItem(settings, checker(['org:manage'], []))).toBe(true);
    expect(canAccessNavItem(settings, checker(['calendar:read'], []))).toBe(false);
  });

  it('a parent is hidden when its own gate fails even if a child would otherwise pass', () => {
    const organization: NavItem = {
      id: 'organization',
      label: 'Organization',
      path: '/organization',
      requiredModules: ['org_structure'],
      requiredPermissions: ['org:read'],
      children: [
        { id: 'organization-companies', label: 'Companies', path: '/organization/companies', requiredPermissions: ['org:read'] }
      ]
    };
    expect(canAccessNavItem(organization, checker(['org:read'], []))).toBe(false);
  });

  it('the wildcard "*" permission unlocks every permission-gated item', () => {
    for (const item of NAV_ITEMS) {
      expect(canAccessNavItem(item, checker(['*'], ['org_structure', 'core_hr', 'calendar', 'leave', 'time_attendance', 'projects']))).toBe(
        true
      );
    }
  });

  describe('NAV_ITEMS (real config)', () => {
    it('grants Work from module entitlement without a module-entry permission', () => {
      const work = NAV_ITEMS.find((item) => item.id === 'work')!;
      expect(canAccessNavItem(work, checker([], ['tasks']))).toBe(true);
      expect(canAccessNavItem(work, checker([], ['objectives_milestones']))).toBe(true);
      expect(canAccessNavItem(work, checker([], ['core_hr']))).toBe(false);
    });

    it('grants Time Off on the "leave" module key, not "time_off", once a child is reachable', () => {
      const timeOff = NAV_ITEMS.find((item) => item.id === 'time-off')!;
      expect(canAccessNavItem(timeOff, checker(['leave:read-own'], ['leave']))).toBe(true);
      expect(canAccessNavItem(timeOff, checker(['leave:read-team'], ['leave']))).toBe(true);
      expect(canAccessNavItem(timeOff, checker(['leave:read-own'], ['time_off']))).toBe(false);
      expect(canAccessNavItem(timeOff, checker([], ['leave']))).toBe(false);
      const balances = timeOff.children!.find((item) => item.id === 'time-off-balances')!;
      expect(balances.label).toBe('Balances');
      expect(timeOff.children!.some((item) => item.id === 'time-off-my-balances' || item.id === 'time-off-team-balances')).toBe(false);
      expect(timeOff.children!.some((item) => item.id === 'time-off-calendar')).toBe(false);
    });

    it('grants Organization on the "org_structure" module key, not "org"', () => {
      const organization = NAV_ITEMS.find((item) => item.id === 'organization')!;
      expect(canAccessNavItem(organization, checker(['org:read'], ['org_structure']))).toBe(true);
      expect(canAccessNavItem(organization, checker(['org:read'], ['org']))).toBe(false);
      expect(canAccessNavItem(organization, checker(['org:manage'], ['org_structure']))).toBe(false);
    });

    it('gates General Settings on legal_entity:update independently of org:read', () => {
      const settings = NAV_ITEMS.find((item) => item.id === 'settings')!;
      const general = settings.children!.find((item) => item.id === 'settings-general')!;

      expect(canAccessNavItem(general, checker(['legal_entity:update'], []))).toBe(true);
      expect(canAccessNavItem(general, checker(['org:read'], ['org_structure']))).toBe(false);
    });

    it('gates Attendance on time_attendance and any of self-service, read, or approve — and keeps Time Tracking reachable for an approve-only user', () => {
      const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance')!;

      expect(attendance.path).toBe('/attendance/overview');
      expect(canAccessNavItem(attendance, checker(['attendance:read-own'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:write-own'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:read'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:approve'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker([], ['time_attendance']))).toBe(false);
      expect(canAccessNavItem(attendance, checker(['attendance:read-own'], []))).toBe(false);

      const children = attendance.children ?? [];
      expect(children.map((child) => child.id)).toEqual([
        'time-attendance-overview',
        'time-attendance-tracking',
        'time-attendance-requests',
        'time-attendance-monitoring'
      ]);
      const monitoring = children.find((child) => child.id === 'time-attendance-monitoring')!;
      expect(monitoring.label).toBe('Monitoring');
      expect(monitoring.path).toBe('/attendance/monitoring');
      expect(canAccessNavItem(monitoring, checker(['monitoring:read'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(monitoring, checker(['attendance:read'], ['time_attendance']))).toBe(false);
      expect(canAccessNavItem(monitoring, checker(['monitoring:read'], []))).toBe(false);
      const tracking = children.find((child) => child.id === 'time-attendance-tracking')!;
      expect(canAccessNavItem(tracking, checker(['attendance:approve'], ['time_attendance']))).toBe(true);

      const requests = children.find((child) => child.id === 'time-attendance-requests')!;
      expect(requests.path).toBe('/attendance/time-tracking/requests');
      expect(requests.path).not.toBe(tracking.path);
      expect(canAccessNavItem(requests, checker(['attendance:read-own'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(requests, checker(['attendance:read'], ['time_attendance']))).toBe(false);
    });

    it('does not leak the parent Attendance item to a monitoring:read-only user (no attendance permission)', () => {
      const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance')!;
      const monitoring = attendance.children!.find((item) => item.id === 'time-attendance-monitoring')!;

      // monitoring:read alone must not unlock the parent - its link target (/attendance/time-tracking)
      // is a page this user cannot open, since Time Tracking is separately gated on attendance:*.
      expect(canAccessNavItem(attendance, checker(['monitoring:read'], ['time_attendance']))).toBe(false);
      // but the child Monitoring item itself is reachable for this user.
      expect(canAccessNavItem(monitoring, checker(['monitoring:read'], ['time_attendance']))).toBe(true);
    });

    it('shows Attendance to an attendance-permission user without monitoring:read, but hides the Monitoring child', () => {
      const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance')!;
      const monitoring = attendance.children!.find((item) => item.id === 'time-attendance-monitoring')!;

      expect(canAccessNavItem(attendance, checker(['attendance:read'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(monitoring, checker(['attendance:read'], ['time_attendance']))).toBe(false);
    });

    it('does not leak Org to a bare Employee through its People section (core_hr module, no employees permission)', () => {
      const people = NAV_ITEMS.find((item) => item.id === 'organization')!;

      // Regression: the "Employees" child used to declare no requiredPermissions at all, so
      // any user with core_hr enabled saw "People" even without managing anyone or employees:write - matching
      // the /people route guard's actual gate (app.routes.ts) closes that gap.
      expect(canAccessNavItem(people, checker([], ['core_hr']))).toBe(false);
      // Managing people is a relationship, surfaced as the MANAGES_PEOPLE capability token.
      expect(canAccessNavItem(people, checker([MANAGES_PEOPLE], ['core_hr']))).toBe(true);
      expect(canAccessNavItem(people, checker(['employees:write'], ['core_hr']))).toBe(true);
      // roles:manage alone no longer shows People: position approvals moved to the Inbox with the Approvals child.
      expect(canAccessNavItem(people, checker(['roles:manage'], ['core_hr']))).toBe(false);
    });

    it('lists the Organization section before the People section under Org', () => {
      const org = NAV_ITEMS.find((item) => item.id === 'organization')!;
      expect(org.children!.map((child) => `${child.section}:${child.label}`)).toEqual([
        'Organization:Departments', 'Organization:Positions', 'People:Employees', 'People:Checklists', 'People:Offboarding'
      ]);
    });
  });

  it('settings-bulk-onboarding requires both core_hr module and employees:write permission', () => {
    const item: NavItem = {
      id: 'settings-bulk-onboarding', label: 'Bulk Onboarding', path: '/settings/bulk-onboarding',
      requiredModules: ['core_hr'], requiredPermissions: ['employees:write']
    };

    expect(canAccessNavItem(item, checker(['employees:write'], ['core_hr']))).toBe(true);
    expect(canAccessNavItem(item, checker(['employees:write'], []))).toBe(false);
    expect(canAccessNavItem(item, checker([], ['core_hr']))).toBe(false);
  });

    it('settings-clock-in-policy requires time_attendance module and attendance:read', () => {
    const settings = NAV_ITEMS.find((item) => item.id === 'settings')!;
    const clockIn = settings.children!.find((item) => item.id === 'settings-clock-in-policy')!;

    expect(clockIn.label).toBe('Clock-in Policy');
    expect(clockIn.path).toBe('/settings/clock-in-policy');
    expect(canAccessNavItem(clockIn, checker(['attendance:read'], ['time_attendance']))).toBe(true);
    expect(canAccessNavItem(clockIn, checker(['attendance:read'], []))).toBe(false);
    expect(canAccessNavItem(clockIn, checker([], ['time_attendance']))).toBe(false);
    expect(canAccessNavItem(clockIn, checker(['org:manage'], ['time_attendance']))).toBe(false);
  });

  it('settings-users needs users:read or users:manage - adding employees alone does not reveal it', () => {
    const settings = NAV_ITEMS.find((item) => item.id === 'settings')!;
    const users = settings.children!.find((item) => item.id === 'settings-users')!;

    expect(users.path).toBe('/settings/users');
    expect(canAccessNavItem(users, checker(['users:read'], []))).toBe(true);
    expect(canAccessNavItem(users, checker(['users:manage'], []))).toBe(true);
    expect(canAccessNavItem(users, checker(['employees:write'], ['core_hr']))).toBe(false);
  });

});
