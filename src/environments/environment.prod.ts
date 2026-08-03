import { RuntimeConfig } from '../app/core/config/runtime-config.model';
import { buildApiUrl, buildWsUrl } from './environment-url.helper';

// Same-origin strategy, chosen deliberately over a fixed API host (e.g. api.onevo.example):
// HostTenantResolutionMiddleware resolves tenant context purely from the incoming request's Host
// header. A fixed API domain would never see "{tenantSlug}.onevo.com" in that header, so every
// tenant request would resolve to System context instead of the tenant's own context. Calling the
// same hostname the Angular app is served from means the backend sees the real tenant host on
// every request. This assumes the production reverse proxy/edge routes /api and /ws paths on that
// same hostname through to the backend without rewriting Host. If a separate API domain is
// reintroduced, the backend must instead resolve tenant context from a forwarded header (e.g.
// X-Forwarded-Host) - do not silently point back at a fixed api.* host without that backend change.
const { protocol, hostname } = window.location;

export const environment = {
  production: true,
  environmentName: 'production',
  apiUrl: buildApiUrl(protocol, hostname),
  wsUrl: buildWsUrl(protocol, hostname),
  enableDebugLogs: false,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
