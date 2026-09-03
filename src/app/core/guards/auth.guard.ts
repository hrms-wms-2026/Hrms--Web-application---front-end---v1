import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/state/auth.store';

export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const authenticated = await authStore.checkSession();
  if (authenticated) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};
