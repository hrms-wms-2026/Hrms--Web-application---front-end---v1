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
      requiredPermissions: ['org:read', 'org:manage']
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
      requiredPermissions: ['org:read', 'org:manage'],
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
    it('grants exactly the documented modules for Work', () => {
      const work = NAV_ITEMS.find((item) => item.id === 'work')!;
      expect(canAccessNavItem(work, checker([], ['tasks']))).toBe(true);
      expect(canAccessNavItem(work, checker([], ['objectives_milestones']))).toBe(true);
      expect(canAccessNavItem(work, checker([], ['core_hr']))).toBe(false);
    });

    it('grants Time Off on the "leave" module key, not "time_off"', () => {
      const timeOff = NAV_ITEMS.find((item) => item.id === 'time-off')!;
      expect(canAccessNavItem(timeOff, checker([], ['leave']))).toBe(true);
      expect(canAccessNavItem(timeOff, checker([], ['time_off']))).toBe(false);
    });

    it('grants Organization on the "org_structure" module key, not "org"', () => {
      const organization = NAV_ITEMS.find((item) => item.id === 'organization')!;
      expect(canAccessNavItem(organization, checker(['org:read'], ['org_structure']))).toBe(true);
      expect(canAccessNavItem(organization, checker(['org:read'], ['org']))).toBe(false);
    });
  });
});
