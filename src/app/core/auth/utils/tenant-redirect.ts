import { AUTH_COOKIE_NAMES } from '../auth-cookie-names';
import { clearSingleHostTenant, getSingleHostTenant, isSingleHostMode } from './single-host-tenant';

const LAST_TENANT_COOKIE = AUTH_COOKIE_NAMES.lastTenant;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidTenantSlug(value: string): boolean {
  return TENANT_SLUG_PATTERN.test(value);
}

/**
 * Reads the cross-subdomain tenant hint. The cookie is deliberately non-authoritative: callers
 * must still validate the real tenant session before treating the visitor as authenticated.
 */
export function readLastTenantSlug(cookieHeader: string): string | null {
  const match = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LAST_TENANT_COOKIE}=`));

  if (!match) return null;

  try {
    const value = decodeURIComponent(match.slice(LAST_TENANT_COOKIE.length + 1));
    return isValidTenantSlug(value) ? value : null;
  } catch {
    return null;
  }
}

export function getRootHostname(hostname: string): string {
  if (isSingleHostMode()) {
    return hostname;
  }
  if (hostname.endsWith('.localhost')) {
    return 'localhost';
  }
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return hostname;
  }
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(1).join('.');
  }
  return hostname;
}

/**
 * Builds the URL for a tenant's own subdomain, reusing the current protocol/hostname/port so
 * this works unchanged across dev ({slug}.localhost:4200) and production ({slug}.<root domain>).
 * Login always happens on the root domain, but if called from a tenant host, getRootHostname
 * ensures the root domain is used.
 */
export function buildTenantUrl(slug: string, path: string): string {
  if (isSingleHostMode()) {
    // Same host; the tenant travels as a query value that captureSingleHostTenantFromUrl stores.
    return `${hostOrigin('')}${path}${path.includes('?') ? '&' : '?'}tenant=${slug}`;
  }
  return `${hostOrigin(`${slug}.`)}${path}`;
}

/** Current protocol + (optional subdomain prefix +) root hostname + port. */
function hostOrigin(prefix: string): string {
  const { protocol, hostname, port } = window.location;
  return `${protocol}//${prefix}${getRootHostname(hostname)}${port ? `:${port}` : ''}`;
}

/** True when hostname is a tenant subdomain rather than the root frontend host itself. */
export function isTenantHostname(hostname: string): boolean {
  if (isSingleHostMode()) {
    return getSingleHostTenant() !== null;
  }
  return getRootHostname(hostname) !== hostname;
}

/**
 * Frontend-navigation counterpart to auth-api.service.ts's getSystemApiUrl: builds a same-page
 * path on the root frontend host, reusing the current protocol/port. Used to bounce base-login
 * gates (login, legal-consent) off a tenant host back onto the root host they must run on.
 */
export function buildRootUrl(path: string): string {
  if (isSingleHostMode()) {
    // Drop any ?tenant= from the target: the reloaded page would otherwise re-capture the slug and
    // bounce again forever.
    clearSingleHostTenant();
    path = path.replace(/([?&])tenant=[^&]*&?/, '$1').replace(/[?&]$/, '');
  }
  return `${hostOrigin('')}${path}`;
}
