import { CSRF_ERROR_TYPE } from '../auth/auth-cookie-names';
import { HttpContextToken, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { clearSingleHostTenant, isSingleHostMode } from '../auth/utils/single-host-tenant';
import { AuthStore } from '../auth/state/auth.store';
import { ErrorHandlerService } from '../services/error-handler.service';
import { rememberCorrelationId } from '../errors/api-error';
import { TrayPresenceRequiredEvents } from '../tray-presence/state/tray-presence-required.events';

const RETRY_DELAYS_MS = [250, 500, 1000];

/** Set on a request whose caller handles its errors itself (e.g. hides a section): no banner/toast for it. Session
 *  handling (401, CSRF) still applies. */
export const SILENT_HTTP_ERRORS = new HttpContextToken<boolean>(() => false);

/** The backend's answer when the signed-in account has no employee profile (e.g. a company owner who has not
 *  added themselves yet). Screens show their own "profile isn't set up" state, so it is never toasted. */
export const NO_EMPLOYEE_DETAIL = 'No employee record for the current user.';
/** The same answer as worded by the Leave features. */
const NO_EMPLOYEE_DETAILS: ReadonlySet<string> = new Set([
  NO_EMPLOYEE_DETAIL,
  'No employee record is linked to the current user.'
]);
const SESSION_EXEMPT_PATH_FRAGMENTS = ['/auth/login', '/auth/me'];

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

/**
 * Single-host test mode: TenantEnforcementMiddleware answers "slug for tenant A, cookie for tenant B" with a
 * 403 whose detail is this text (and clears the session cookies). Like a stale CSRF 403, it means the session
 * is unusable and the user needs to sign in again.
 */
const TENANT_MISMATCH_DETAIL = 'Token tenant does not match request host tenant.';

function isTenantMismatchError(error: HttpErrorResponse): boolean {
  return isSingleHostMode() && error.status === 403 && error.error?.detail === TENANT_MISMATCH_DETAIL;
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
      // The correlation interceptor runs first, so this is the id the backend logged the request under.
      rememberCorrelationId(error, req.headers.get('X-Correlation-ID'));
      if (isActiveTrayRequired(error)) {
        trayPresenceEvents.publish();
        return throwError(() => error);
      }

      if (error.status === 429 && req.url.includes('/monitoring/activation/generate')) {
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

      if (isCsrfError(error) || isTenantMismatchError(error)) {
        // No stored slug means no tenant header on the login page, so this cannot re-trigger.
        clearSingleHostTenant();
        authStore.clearSession();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      if (!req.context.get(SILENT_HTTP_ERRORS) && !NO_EMPLOYEE_DETAILS.has(error.error?.detail)) errorHandler.handle(error);
      return throwError(() => error);
    })
  );
};
