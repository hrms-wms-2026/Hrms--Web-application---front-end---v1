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

