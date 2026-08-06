import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/state/auth.store';

/**
 * Inverse of authGuard: keeps the public landing route public for guests while preserving the
 * app's existing behaviour of sending an already-signed-in visitor straight to /dashboard instead
 * of showing them the marketing page.
 */
export const redirectIfAuthenticatedGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const authenticated = await authStore.checkSession();
  if (authenticated) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
