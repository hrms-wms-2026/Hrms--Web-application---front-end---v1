import { RuntimeConfig } from '../app/core/config/runtime-config.model';
import { buildApiUrl, buildWsUrl } from './environment-url.helper';

// Same-origin strategy - see environment.prod.ts for the full rationale. HostTenantResolutionMiddleware
// resolves tenant context from the request Host header, so staging must call the same hostname the
// Angular app is served from rather than a fixed staging-api.* host, or tenant subdomains would
// resolve to System context.
const { protocol, hostname } = window.location;

export const environment = {
  production: false,
  environmentName: 'staging',
  apiUrl: buildApiUrl(protocol, hostname),
  wsUrl: buildWsUrl(protocol, hostname),
  enableDebugLogs: false,
  appName: 'CROWNUS HRMS',
  tenancyMode: 'subdomain',
} as const satisfies RuntimeConfig;
