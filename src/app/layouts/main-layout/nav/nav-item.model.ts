export type NavIconName =
  | 'home'
  | 'work'
  | 'inbox'
  | 'people'
  | 'calendar'
  | 'time-off'
  | 'time-attendance'
  | 'organization'
  | 'settings'
  | 'more';

export interface NavItem {
  id: string;
  label: string;
  /** Absolute router path, e.g. '/organization/departments'. */
  path: string;
  /** Rail icon - only set on top-level items; sub-sidebar entries render as text. */
  icon?: NavIconName;
  /** Any-of match against AuthStore.activeModules(). */
  requiredModules?: readonly string[];
  /** Any-of match against AuthStore.permissions(). */
  requiredPermissions?: readonly string[];
  /** Sub-sidebar entries shown when this item's section is active. */
  children?: readonly NavItem[];
  /** Match only the exact path when applying the shared submenu active state. */
  exact?: boolean;
  /** Other URL areas this rail item owns (e.g. Org also owns /people), so their pages keep it active. */
  alsoMatches?: readonly string[];
  /** Rail items only: the full name heading the mobile page switcher, when the rail label is a short form ('Org'). */
  menuTitle?: string;
  /** One line under the label in the mobile More sheet. */
  description?: string;
  /** Sub-sidebar entries only: the titled group this entry is listed under (consecutive entries share a title). */
  section?: string;
  /** A module that renders its own sub-sidebar instead of a list of child links (the inbox's chat list). */
  customSubSidebar?: 'inbox';
}
