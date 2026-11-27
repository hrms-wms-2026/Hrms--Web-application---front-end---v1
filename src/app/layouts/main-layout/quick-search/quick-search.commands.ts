import { NavIconName, NavItem } from '../nav/nav-item.model';

export type QuickSearchGroup = 'Pages' | 'Actions' | 'People';

/** Something the Quick Search popup can open: a page (router link) or an action (a popup or a page with a form open). */
export interface QuickSearchCommand {
  id: string;
  label: string;
  group: QuickSearchGroup;
  /** Where it lives, shown greyed beside the label ("Settings", "Org"). */
  hint?: string;
  /** Rail icon of the section it belongs to. */
  icon?: NavIconName;
  /** Extra words it matches on (its description, other names for it). */
  keywords?: string;
  route?: string;
  queryParams?: Record<string, string>;
  /** Actions that open a popup in place instead of a page. */
  run?: 'request-time-off';
  /** People results: shown as an avatar instead of an icon. */
  person?: { name: string; avatarUrl: string | null };
}

/** The smallest query that searches people (one letter matches half the company). */
export const PEOPLE_SEARCH_MIN_LENGTH = 2;

/** A person from the employee list as a Quick Search result that opens their profile. */
export function personCommand(
  employee: { id: string; fullName: string; positionName: string | null; departmentName: string | null },
  avatarUrl: string | null
): QuickSearchCommand {
  return {
    id: `person-${employee.id}`,
    label: employee.fullName,
    group: 'People',
    hint: employee.positionName ?? employee.departmentName ?? undefined,
    route: `/people/employees/${employee.id}`,
    person: { name: employee.fullName, avatarUrl }
  };
}

/** What the builder needs to know about the viewer (NavigationStateService and PermissionService fit it). */
export interface QuickSearchAccess {
  /** Rail items the viewer can open, in rail order. */
  visibleItems: readonly NavItem[];
  accessibleChildren(item: NavItem): readonly NavItem[];
  hasPermission(permission: string): boolean;
  hasModule(module: string): boolean;
}

/** Other names people type for a page, beyond its label and description. */
const EXTRA_KEYWORDS: Record<string, string | undefined> = {
  home: 'dashboard my work start',
  inbox: 'messages chats requests approvals',
  calendar: 'planner schedule events meetings',
  'time-off': 'leave holiday vacation absence pto',
  'time-attendance': 'clock in clock out timesheet hours',
  'people-employees': 'staff people team directory',
  'settings-roles': 'permissions access',
  'settings-users': 'accounts invite',
  'settings-time-off': 'leave types policies entitlements holidays',
  'settings-clock-in-policy': 'attendance geofence location',
  'settings-support': 'help ticket'
};

/**
 * Every page and action the viewer can open, by the same rules as the sidebar: rail items without a sub-sidebar
 * are pages, and a rail item with one (Org, Settings) lists each child the viewer can reach instead.
 */
export function buildQuickSearchCommands(access: QuickSearchAccess): QuickSearchCommand[] {
  const pages: QuickSearchCommand[] = [];
  for (const item of access.visibleItems) {
    const children = access.accessibleChildren(item);
    if (children.length === 0) {
      pages.push(page(item, item.icon));
      if (item.id === 'home') {
        pages.push({ id: 'my-team', label: 'My Team', group: 'Pages', hint: 'Home', icon: 'home', keywords: 'team dashboard', route: '/dashboard/my-team' });
      }
      continue;
    }
    for (const child of children) {
      pages.push(page(child, item.icon, item.label));
    }
  }

  const actions: QuickSearchCommand[] = [];
  if (access.visibleItems.some((item) => item.id === 'time-off')) {
    actions.push({ id: 'action-request-time-off', label: 'Request time off', group: 'Actions', icon: 'time-off', keywords: 'new leave holiday vacation apply', run: 'request-time-off' });
  }
  if (access.hasModule('core_hr') && access.hasPermission('employees:write')) {
    actions.push({ id: 'action-add-employee', label: 'Add employee', group: 'Actions', icon: 'organization', keywords: 'new hire onboard create person', route: '/people/employees', queryParams: { addEmployee: 'true' } });
  }
  return [...pages, ...actions];
}

function page(item: NavItem, icon: NavIconName | undefined, hint?: string): QuickSearchCommand {
  return {
    id: item.id,
    label: item.label,
    group: 'Pages',
    hint,
    icon,
    keywords: [item.description, EXTRA_KEYWORDS[item.id]].filter(Boolean).join(' '),
    route: item.path
  };
}

/**
 * The commands matching the query, best first. Every word typed must match somewhere (label, hint or keywords);
 * a label that starts with the query beats one with a word starting with it, which beats a keyword-only match.
 */
export function filterQuickSearchCommands(commands: readonly QuickSearchCommand[], query: string): QuickSearchCommand[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];
  const q = words.join(' ');

  return commands
    .map((command, index) => ({ command, index, score: score(command, q, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}

function score(command: QuickSearchCommand, q: string, words: readonly string[]): number {
  const label = command.label.toLowerCase();
  const haystack = `${label} ${(command.hint ?? '').toLowerCase()} ${(command.keywords ?? '').toLowerCase()}`;
  if (!words.every((word) => haystack.includes(word))) return 0;
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/[\s&-]+/).some((part) => part.startsWith(q))) return 60;
  if (label.includes(q)) return 40;
  if (words.every((word) => label.includes(word))) return 30;
  return 10;
}
