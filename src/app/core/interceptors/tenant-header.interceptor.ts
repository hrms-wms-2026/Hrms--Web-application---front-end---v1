import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@environments/environment';
import { getSingleHostTenant } from '../auth/utils/single-host-tenant';

/**
 * Single-host test mode only: tells the backend which tenant to use, for same-origin API calls.
 * getSingleHostTenant() is null outside single-host mode, so subdomain builds never add the header.
 * Relative URLs (a relative apiUrl or request URL) resolve against the page origin.
 */
export const tenantHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  const slug = getSingleHostTenant();
  if (!slug) return next(req);

  const base = window.location.origin;
  try {
    if (new URL(req.url, base).origin !== new URL(environment.apiUrl, base).origin) return next(req);
  } catch {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Crownus-Tenant': slug } }));
};
