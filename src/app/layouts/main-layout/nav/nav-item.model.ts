export type NavIconName =
  | 'home'
  | 'work'
  | 'people'
  | 'calendar'
  | 'time-off'
  | 'time-attendance'
  | 'organization'
  | 'settings';

export interface NavItem {
  id: string;
  label: string;
  /** Absolute router path, e.g. '/organization/departments'. */
  path: string;
  /** Rail icon - only set on top-level items; sub-sidebar entries render as text. */
  icon?: NavIconName;
  /**
   * Any-of match against AuthStore.activeModules(). Omit to skip module gating
   * (e.g. Home, and Settings, whose own active_modules never appear in
   * active_modules per PermissionResolver.cs - see PermissionService).
   */
  requiredModules?: readonly string[];
  /** Any-of match against AuthStore.permissions(). Omit to skip permission gating. */
  requiredPermissions?: readonly string[];
  /** Sub-sidebar entries shown when this item's section is active. */
  children?: readonly NavItem[];
}
