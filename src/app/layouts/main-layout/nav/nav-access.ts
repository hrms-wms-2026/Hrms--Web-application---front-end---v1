import { NavItem } from './nav-item.model';

/** Structurally compatible with PermissionService - kept decoupled from Angular DI so this stays a pure, easily-testable function. */
export interface NavAccessChecker {
  hasAnyModule(modules: readonly string[]): boolean;
  hasAnyPermission(permissions: readonly string[]): boolean;
}

/**
 * A leaf item is visible when its own module/permission gates pass. A parent item
 * (Organization, Settings) is visible when its own gates pass AND at least one child
 * is reachable - this is what lets Settings stay visible purely from child-level
 * permissions (roles:manage, notifications:manage, ...) without hardcoding one
 * permission on the parent, per the Part 2A design.
 */
export function canAccessNavItem(item: NavItem, checker: NavAccessChecker): boolean {
  const moduleOk = !item.requiredModules || item.requiredModules.length === 0 || checker.hasAnyModule(item.requiredModules);
  const permissionOk =
    !item.requiredPermissions || item.requiredPermissions.length === 0 || checker.hasAnyPermission(item.requiredPermissions);
  const selfOk = moduleOk && permissionOk;

  if (!item.children || item.children.length === 0) {
    return selfOk;
  }

  return selfOk && item.children.some((child) => canAccessNavItem(child, checker));
}
