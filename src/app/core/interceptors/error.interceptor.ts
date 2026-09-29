import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthStore } from '../auth/state/auth.store';
import { ErrorHandlerService } from '../services/error-handler.service';
import { TrayPresenceRequiredEvents } from '../tray-presence/state/tray-presence-required.events';

const RETRY_DELAYS_MS = [250, 500, 1000];
const SESSION_EXEMPT_PATH_FRAGMENTS = ['/auth/login', '/auth/me'];
const CSRF_ERROR_TYPE = 'https://onevo.com/errors/csrf';

function isSessionExempt(url: string): boolean {
  return SESSION_EXEMPT_PATH_FRAGMENTS.some((fragment) => url.includes(fragment));
}

/**
 * Distinguishes a stale/expired-session CSRF rejection (CsrfProtectionMiddleware.cs) from an
 * ordinary permission-denied 403 - both are HTTP 403, but only the CSRF one means the session
 * itself is gone and needs a fresh login. There is no refresh-token flow to recover from this
 * silently (SessionPolicy.cs: "Single session cookie with sliding expiry (no refresh token) -
 * see fixed architecture decision") - the session already renews transparently server-side on
 * every authenticated request (30min sliding window, 8h absolute cap), so reaching this state
 * means the tab was idle past that window, not a bug to retry around.
 */
function isActiveTrayRequired(error: HttpErrorResponse): boolean {
  return error.status === 428 && error.error?.code === 'active_tray_required';
}

function isCsrfError(error: HttpErrorResponse): boolean {

  return error.status === 403 && error.error?.type === CSRF_ERROR_TYPE;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const errorHandler = inject(ErrorHandlerService);
  const trayPresenceEvents = inject(TrayPresenceRequiredEvents);

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, attempt: number) => {
        // A 5xx/dropped connection on a write doesn't prove it wasn't applied - retrying it duplicated calendar events.
        const isSafeToRetry = req.method === 'GET' || req.method === 'HEAD';
        if (isSafeToRetry && (error.status >= 500 || error.status === 0)) {
          return timer(RETRY_DELAYS_MS[attempt - 1] ?? 1000);
        }
        throw error;
      }
    }),
    catchError((error: HttpErrorResponse) => {
            if (isActiveTrayRequired(error)) {
        trayPresenceEvents.publish();
        return throwError(() => error);
      }

      if (error.status === 401 && isSessionExempt(req.url)) {

        return throwError(() => error);
      }

      if (error.status === 401) {
        authStore.clearSession();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      if (isCsrfError(error)) {
        authStore.clearSession();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      errorHandler.handle(error);
      return throwError(() => error);
    })
  );
};
