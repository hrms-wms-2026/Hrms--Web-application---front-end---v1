import { environment } from '@environments/environment';
import { RuntimeConfig } from '../../config/runtime-config.model';
import { isValidTenantSlug } from './tenant-redirect';

/** sessionStorage key holding the tenant slug while running in single-host test mode. */
export const SINGLE_HOST_TENANT_KEY = 'crownus.singleHostTenant';

/** Request header naming the tenant in single-host mode (mirrors the backend's TenancyHeaders.Tenant). */
export const TENANT_HEADER = 'X-Crownus-Tenant';

/** Backend slug bounds (HostTenantResolutionMiddleware.SlugPattern): 3-63 chars. isValidTenantSlug allows 1+. */
const SINGLE_HOST_SLUG_MIN_LENGTH = 3;

function isAcceptableSingleHostSlug(slug: string): boolean {
  return slug.length >= SINGLE_HOST_SLUG_MIN_LENGTH && isValidTenantSlug(slug);
}

export function isSingleHostMode(): boolean {
  // Widen from the literal type of the per-build environment object.
  return (environment as RuntimeConfig).tenancyMode === 'single-host';
}

/** Runs a sessionStorage operation; storage being unavailable degrades to "no slug". */
function withStorage<T>(op: (storage: Storage) => T): T | null {
  try {
    return op(sessionStorage);
  } catch {
    return null;
  }
}

/** Reads ?tenant=<slug> and remembers it. Invalid or missing values are ignored (stored slug kept). */
export function captureSingleHostTenantFromUrl(search: string = window.location.search): void {
  setSingleHostTenant(new URLSearchParams(search).get('tenant') ?? '');
}

export function getSingleHostTenant(): string | null {
  const slug = isSingleHostMode() ? withStorage((s) => s.getItem(SINGLE_HOST_TENANT_KEY)) : null;
  return slug && isAcceptableSingleHostSlug(slug) ? slug : null;
}

export function setSingleHostTenant(slug: string): void {
  if (isSingleHostMode() && isAcceptableSingleHostSlug(slug)) {
    withStorage((s) => s.setItem(SINGLE_HOST_TENANT_KEY, slug));
  }
}

export function clearSingleHostTenant(): void {
  if (isSingleHostMode()) {
    withStorage((s) => s.removeItem(SINGLE_HOST_TENANT_KEY));
  }
}
