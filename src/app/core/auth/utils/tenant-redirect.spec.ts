import { environment } from '@environments/environment';
import { getSingleHostTenant } from './single-host-tenant';
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
    expect(readLastTenantSlug('theme=dark; crownus_last_tenant=acme-team; other=value')).toBe('acme-team');
  });

  it('rejects malformed and encoded-host tenant values', () => {
    expect(readLastTenantSlug('crownus_last_tenant=acme.evil.test')).toBeNull();
    expect(readLastTenantSlug('crownus_last_tenant=acme%2Eevil%2Etest')).toBeNull();
    expect(readLastTenantSlug('crownus_last_tenant=%E0%A4%A')).toBeNull();
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

describe('single-host redirect helpers', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;
  let originalLocation: Location;

  function stubLocation(protocol: string, hostname: string, port = '') {
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = { protocol, hostname, port, search: '', href: '' } as unknown as string & Location;
  }

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    originalLocation = window.location;
    mutableEnv.tenancyMode = 'single-host';
    sessionStorage.clear();
  });

  afterEach(() => {
    window.location = originalLocation as unknown as string & Location;
    mutableEnv.tenancyMode = originalMode;
    sessionStorage.clear();
  });

  it('single-host buildTenantUrl keeps host and adds tenant query', () => {
    stubLocation('https:', 'app.azurewebsites.net');
    expect(buildTenantUrl('acme', '/dashboard')).toBe('https://app.azurewebsites.net/dashboard?tenant=acme');
  });

  it('single-host buildTenantUrl appends to an existing query', () => {
    stubLocation('https:', 'app.azurewebsites.net');
    expect(buildTenantUrl('acme', '/x?a=1')).toBe('https://app.azurewebsites.net/x?a=1&tenant=acme');
  });

  it('single-host getRootHostname keeps uksouth-01 host intact', () => {
    const host = 'onexso-api-x.uksouth-01.azurewebsites.net';
    expect(getRootHostname(host)).toBe(host);
  });

  it('single-host buildRootUrl clears slug', () => {
    stubLocation('https:', 'app.azurewebsites.net');
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    expect(buildRootUrl('/auth/login')).toBe('https://app.azurewebsites.net/auth/login');
    expect(getSingleHostTenant()).toBeNull();
  });

  it('single-host buildRootUrl strips the tenant param so the redirect cannot re-capture a slug', () => {
    stubLocation('https:', 'app.azurewebsites.net');
    expect(buildRootUrl('/auth/login?tenant=acme&returnUrl=%2Fx')).toBe(
      'https://app.azurewebsites.net/auth/login?returnUrl=%2Fx'
    );
    expect(buildRootUrl('/auth/login?tenant=acme')).toBe('https://app.azurewebsites.net/auth/login');
  });

  it('single-host isTenantHostname reflects the stored slug', () => {
    expect(isTenantHostname('app.azurewebsites.net')).toBe(false);
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    expect(isTenantHostname('app.azurewebsites.net')).toBe(true);
  });

  it('subdomain behaviour unchanged', () => {
    mutableEnv.tenancyMode = 'subdomain';
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    stubLocation('https:', 'acme.crownus.test');
    expect(getRootHostname('acme.crownus.test')).toBe('crownus.test');
    expect(isTenantHostname('acme.crownus.test')).toBe(true);
    expect(isTenantHostname('crownus.test')).toBe(false);
    expect(buildTenantUrl('beta', '/dashboard')).toBe('https://beta.crownus.test/dashboard');
    expect(buildRootUrl('/auth/login')).toBe('https://crownus.test/auth/login');
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBe('acme');
  });
});
