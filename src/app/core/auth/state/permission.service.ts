import { Injectable, inject } from '@angular/core';
import { AuthStore } from './auth.store';

/** Granted to platform superusers by PermissionResolver.cs instead of an enumerated list. */
const WILDCARD_PERMISSION = '*';

/**
 * Frontend-only capability token, never a backend permission code: true when the user's
 * position covers other employees (session `manages_people`). Employee visibility is
 * relationship-based, so the People screens list this next to real permissions in
 * requiredPermissions / route data permissions, and the any-of checks pick it up.
 */
export const MANAGES_PEOPLE = 'relationship:manages-people';

/**
 * Central permission/module gating used by navigation, route guards, and the
 * appHasPermission structural directive. Always derives from AuthStore's
 * backend-provided permissions/activeModules - never from role names, which the
 * backend does not expose (see AuthState in auth.store.ts).
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authStore = inject(AuthStore);

  hasPermission(permission: string): boolean {
    if (permission === MANAGES_PEOPLE) {
      return this.authStore.managesPeople();
    }
    const permissions = this.authStore.permissions();
    return permissions.includes(WILDCARD_PERMISSION) || permissions.includes(permission);
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    if (permissions.length === 0) {
      return false;
    }
    if (this.authStore.permissions().includes(WILDCARD_PERMISSION)) {
      return true;
    }
    return permissions.some((permission) => this.hasPermission(permission));
  }

  hasModule(module: string): boolean {
    return this.authStore.activeModules().includes(module);
  }

  hasAnyModule(modules: readonly string[]): boolean {
    if (modules.length === 0) {
      return false;
    }
    const activeModules = this.authStore.activeModules();
    return modules.some((module) => activeModules.includes(module));
  }
}
