import { NavItem } from '../nav/nav-item.model';
import { QuickSearchAccess, buildQuickSearchCommands, filterQuickSearchCommands, personCommand } from './quick-search.commands';

const home: NavItem = { id: 'home', label: 'Home', icon: 'home', path: '/dashboard' };
const timeOff: NavItem = { id: 'time-off', label: 'Time Off', icon: 'time-off', path: '/time-off', description: 'Leaves, holidays and time off.' };
const settings: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: 'settings',
  path: '/settings',
  children: [
    { id: 'settings-users', label: 'Users', path: '/settings/users' },
    { id: 'settings-roles', label: 'Roles & Permissions', path: '/settings/roles' }
  ]
};

function access(overrides: Partial<QuickSearchAccess> = {}): QuickSearchAccess {
  return {
    visibleItems: [home, timeOff, settings],
    accessibleChildren: (item) => item.children ?? [],
    hasPermission: () => false,
    hasModule: () => false,
    ...overrides
  };
}

describe('buildQuickSearchCommands', () => {
  it('lists rail pages, and the reachable children of a rail item with a sub-sidebar instead of the item itself', () => {
    const ids = buildQuickSearchCommands(access()).map((command) => command.id);
    expect(ids).toEqual(['home', 'my-team', 'time-off', 'settings-users', 'settings-roles', 'action-request-time-off']);
  });

  it('labels a child page with its section and leaves out children the viewer cannot reach', () => {
    const commands = buildQuickSearchCommands(
      access({ accessibleChildren: (item) => (item.children ?? []).filter((child) => child.id !== 'settings-roles') })
    );
    expect(commands.find((command) => command.id === 'settings-users')).toMatchObject({ hint: 'Settings', route: '/settings/users', icon: 'settings' });
    expect(commands.some((command) => command.id === 'settings-roles')).toBe(false);
  });

  it('offers Request time off only when Time Off is on the rail', () => {
    const commands = buildQuickSearchCommands(access({ visibleItems: [home] }));
    expect(commands.some((command) => command.id === 'action-request-time-off')).toBe(false);
  });

  it('offers Add employee only with core HR and employees:write', () => {
    const withoutWrite = buildQuickSearchCommands(access({ hasModule: () => true }));
    expect(withoutWrite.some((command) => command.id === 'action-add-employee')).toBe(false);

    const withWrite = buildQuickSearchCommands(access({ hasModule: (m) => m === 'core_hr', hasPermission: (p) => p === 'employees:write' }));
    expect(withWrite.find((command) => command.id === 'action-add-employee')).toMatchObject({
      route: '/people/employees',
      queryParams: { addEmployee: 'true' }
    });
  });
});

describe('personCommand', () => {
  it('opens the profile and shows the position, else the department', () => {
    const employee = { id: 'e1', fullName: 'Asha Perera', positionName: null, departmentName: 'Design' };
    expect(personCommand(employee, 'https://files/a.png')).toEqual({
      id: 'person-e1',
      label: 'Asha Perera',
      group: 'People',
      hint: 'Design',
      route: '/people/employees/e1',
      person: { name: 'Asha Perera', avatarUrl: 'https://files/a.png' }
    });
    expect(personCommand({ ...employee, positionName: 'Designer' }, null).hint).toBe('Designer');
  });
});

describe('filterQuickSearchCommands', () => {
  const commands = buildQuickSearchCommands(access());

  it('returns everything for an empty query', () => {
    expect(filterQuickSearchCommands(commands, '   ')).toHaveLength(commands.length);
  });

  it('ranks a label that starts with the query above keyword-only matches', () => {
    const ids = filterQuickSearchCommands(commands, 'time').map((command) => command.id);
    expect(ids[0]).toBe('time-off');
    expect(ids).toContain('action-request-time-off');
  });

  it('matches on keywords and section names', () => {
    expect(filterQuickSearchCommands(commands, 'leave').map((command) => command.id)).toEqual(
      expect.arrayContaining(['time-off', 'action-request-time-off'])
    );
    expect(filterQuickSearchCommands(commands, 'settings perm').map((command) => command.id)).toEqual(['settings-roles']);
  });

  it('is case-insensitive and needs every word to match', () => {
    expect(filterQuickSearchCommands(commands, 'USERS').map((command) => command.id)).toEqual(['settings-users']);
    expect(filterQuickSearchCommands(commands, 'users zzz')).toEqual([]);
  });
});
