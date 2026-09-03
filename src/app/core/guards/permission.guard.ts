import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../auth/state/permission.service';

/**
 * Gates a route on route.data['permissions'] (any-of match, backend permission strings
 * only - never role names) and, optionally, route.data['modules'] (any-of match against
 * active_modules) - kept in sync with NAV_ITEMS' requiredModules/requiredPermissions so a
 * route can never be reachable by URL when its nav entry would be hidden. A route with
 * neither entry is left ungated. Must run after authGuard, which guarantees
 * AuthStore.permissions()/activeModules() are already loaded.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const requiredPermissions = (route.data['permissions'] as string[] | undefined) ?? [];
  const requiredModules = (route.data['modules'] as string[] | undefined) ?? [];

  const permissionOk = requiredPermissions.length === 0 || permissionService.hasAnyPermission(requiredPermissions);
  const moduleOk = requiredModules.length === 0 || permissionService.hasAnyModule(requiredModules);

  if (permissionOk && moduleOk) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
