import {
  buildRootUrl,
  buildTenantUrl,
  getRootHostname,
  isTenantHostname,
  isValidTenantSlug,
  readLastTenantSlug
} from './tenant-redirect';

describe('remembered tenant hint', () => {
  it('reads a valid tenant slug from a cookie header', () => {
    expect(readLastTenantSlug('theme=dark; onevo_last_tenant=acme-team; other=value')).toBe('acme-team');
  });

  it('rejects malformed and encoded-host tenant values', () => {
    expect(readLastTenantSlug('onevo_last_tenant=acme.evil.test')).toBeNull();
    expect(readLastTenantSlug('onevo_last_tenant=acme%2Eevil%2Etest')).toBeNull();
    expect(readLastTenantSlug('onevo_last_tenant=%E0%A4%A')).toBeNull();
  });

  it('accepts DNS-label tenant slugs only', () => {
    expect(isValidTenantSlug('acme')).toBe(true);
    expect(isValidTenantSlug('acme-team')).toBe(true);
    expect(isValidTenantSlug('-acme')).toBe(false);
    expect(isValidTenantSlug('acme-')).toBe(false);
  });
});

describe('buildTenantUrl', () => {
  it('prepends the slug to the current hostname, keeping protocol and port', () => {
    const { protocol, hostname, port } = window.location;
    const portSuffix = port ? `:${port}` : '';

    expect(buildTenantUrl('acme', '/dashboard')).toBe(`${protocol}//acme.${hostname}${portSuffix}/dashboard`);
  });
});

describe('getRootHostname', () => {
  it('collapses any *.localhost subdomain to localhost', () => {
    expect(getRootHostname('acme.localhost')).toBe('localhost');
    expect(getRootHostname('acme.tenant.localhost')).toBe('localhost');
  });

  it('returns bare localhost unchanged', () => {
    expect(getRootHostname('localhost')).toBe('localhost');
  });

  it('returns an IPv4 address unchanged', () => {
    expect(getRootHostname('192.168.1.1')).toBe('192.168.1.1');
  });

  it('strips the leftmost label from a multi-label domain', () => {
    expect(getRootHostname('acme.onevo.com')).toBe('onevo.com');
  });

  it('strips only the tenant label when the root domain itself has multiple labels', () => {
    expect(getRootHostname('acme.staging.onevo.com')).toBe('staging.onevo.com');
  });

  it('returns a bare two-label domain unchanged', () => {
    expect(getRootHostname('onevo.com')).toBe('onevo.com');
  });
});

describe('isTenantHostname', () => {
  it('is true for a *.localhost tenant subdomain', () => {
    expect(isTenantHostname('acme.localhost')).toBe(true);
    expect(isTenantHostname('dapi.localhost')).toBe(true);
  });

  it('is true for a production tenant subdomain', () => {
    expect(isTenantHostname('acme.onevo.com')).toBe(true);
  });

  it('is false for the bare root host', () => {
    expect(isTenantHostname('localhost')).toBe(false);
    expect(isTenantHostname('onevo.com')).toBe(false);
  });

  it('is false for an IPv4 address', () => {
    expect(isTenantHostname('192.168.1.1')).toBe(false);
  });
});

describe('buildRootUrl', () => {
  it('keeps protocol/port unchanged when already on the root host', () => {
    const { protocol, hostname, port } = window.location;
    const portSuffix = port ? `:${port}` : '';

    expect(buildRootUrl('/auth/login')).toBe(`${protocol}//${hostname}${portSuffix}/auth/login`);
  });
});
