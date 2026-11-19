import { environment } from '@environments/environment';
import {
  captureSingleHostTenantFromUrl,
  clearSingleHostTenant,
  getSingleHostTenant,
  isSingleHostMode,
  setSingleHostTenant
} from './single-host-tenant';

// `environment` is a plain mutable object at runtime; see auth-api.service.tenant-host.spec.ts for
// why this mutates it instead of vi.mock.
const mutableEnv = environment as unknown as { tenancyMode: string };

describe('single-host tenant store', () => {
  let original: string;

  beforeEach(() => {
    original = mutableEnv.tenancyMode;
    mutableEnv.tenancyMode = 'single-host';
    sessionStorage.clear();
  });

  afterEach(() => {
    mutableEnv.tenancyMode = original;
    sessionStorage.clear();
  });

  it('reports single-host mode from the environment', () => {
    expect(isSingleHostMode()).toBe(true);
    mutableEnv.tenancyMode = 'subdomain';
    expect(isSingleHostMode()).toBe(false);
  });

  it('captures a valid ?tenant=acme', () => {
    captureSingleHostTenantFromUrl('?tenant=acme');
    expect(getSingleHostTenant()).toBe('acme');
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBe('acme');
  });

  it.each(['ACME', 'x.y', '-bad', ''])('ignores invalid value %j and keeps a stored slug', (bad) => {
    setSingleHostTenant('keep');
    captureSingleHostTenantFromUrl(`?tenant=${bad}`);
    expect(getSingleHostTenant()).toBe('keep');
  });

  it('ignores a missing tenant param', () => {
    captureSingleHostTenantFromUrl('?foo=bar');
    expect(getSingleHostTenant()).toBeNull();
  });

  it('stores admin (passes the web pattern; the backend rejects it)', () => {
    captureSingleHostTenantFromUrl('?tenant=admin');
    expect(getSingleHostTenant()).toBe('admin');
  });

  it('set ignores invalid slugs and clear removes the slug', () => {
    setSingleHostTenant('Bad Slug');
    expect(getSingleHostTenant()).toBeNull();
    setSingleHostTenant('acme');
    clearSingleHostTenant();
    expect(getSingleHostTenant()).toBeNull();
  });

  it('is a no-op in subdomain mode', () => {
    mutableEnv.tenancyMode = 'subdomain';
    captureSingleHostTenantFromUrl('?tenant=acme');
    setSingleHostTenant('acme');
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBeNull();
    expect(getSingleHostTenant()).toBeNull();
  });
});
