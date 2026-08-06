export function getRootHostname(hostname: string): string {
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
 * this works unchanged across dev ({slug}.localhost:4200) and production ({slug}.onevo.com).
 * Login always happens on the root domain, but if called from a tenant host, getRootHostname
 * ensures the root domain is used.
 */
export function buildTenantUrl(slug: string, path: string): string {
  const { protocol, hostname, port } = window.location;
  const rootHost = getRootHostname(hostname);
  const portSuffix = port ? `:${port}` : '';
  return `${protocol}//${slug}.${rootHost}${portSuffix}${path}`;
}

/** True when hostname is a tenant subdomain rather than the root frontend host itself. */
export function isTenantHostname(hostname: string): boolean {
  return getRootHostname(hostname) !== hostname;
}

/**
 * Frontend-navigation counterpart to auth-api.service.ts's getSystemApiUrl: builds a same-page
 * path on the root frontend host, reusing the current protocol/port. Used to bounce base-login
 * gates (login, legal-consent) off a tenant host back onto the root host they must run on.
 */
export function buildRootUrl(path: string): string {
  const { protocol, hostname, port } = window.location;
  const rootHost = getRootHostname(hostname);
  const portSuffix = port ? `:${port}` : '';
  return `${protocol}//${rootHost}${portSuffix}${path}`;
}

