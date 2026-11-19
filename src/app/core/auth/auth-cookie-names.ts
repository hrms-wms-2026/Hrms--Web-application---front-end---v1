/**
 * Browser cookie names set by the backend (`ONEVO.Api/Auth/AuthCookieNames.cs`).
 * A rename must ship with the backend in the same release.
 */
export const AUTH_COOKIE_NAMES = {
  session: 'crownus_session',
  csrf: 'crownus_csrf',
  mfa: 'crownus_mfa',
  legalPending: 'crownus_legal_pending',
  legalCsrf: 'crownus_legal_csrf',
  lastTenant: 'crownus_last_tenant',
} as const;

/** CSRF cookies the app echoes back as X-CSRF-Token, full session first. */
export const CSRF_COOKIE_NAMES: readonly string[] = [AUTH_COOKIE_NAMES.csrf, AUTH_COOKIE_NAMES.legalCsrf];

/** Problem `type` the backend returns for a CSRF failure (`ONEVO.Api/Errors/ProblemTypes.cs`). */
export const CSRF_ERROR_TYPE = 'urn:crownus:error:csrf';
