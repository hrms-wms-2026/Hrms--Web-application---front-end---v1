import { RuntimeConfig } from '../app/core/config/runtime-config.model';
import { buildLocalApiUrl, buildLocalWsUrl } from './environment-url.helper';

// Local development is HTTPS-only: `dotnet run` uses ONEVO.Api/Properties/launchSettings.json's
// single "https" profile (https://localhost:7229) and `npm start` runs `ng serve --ssl true`
// (https://localhost:4200). There is no local HTTP fallback and nothing here reads
// window.location.protocol to branch between HTTP/HTTPS or between backend ports.
//
// The backend resolves tenant context purely from the request Host header
// (HostTenantResolutionMiddleware): bare "localhost" is System context (only POST /auth/login
// works there - tenant-host password login is explicitly rejected), while "{slug}.localhost" is
// Tenant context (required by every other endpoint, e.g. GET /auth/me, regardless of session
// validity). The frontend mirrors this by always calling the backend on the SAME hostname the
// Angular app itself is currently running on: on the login page that's the root domain
// (correct for POST /auth/login), and after AuthStore redirects the browser to
// "{workspace.slug}.<root>" following a fully-authenticated response, this file re-evaluates on
// that fresh page load with the tenant subdomain already in window.location.hostname.
const { hostname } = window.location;

export const environment = {
  production: false,
  environmentName: 'development',
  apiUrl: buildLocalApiUrl(hostname),
  wsUrl: buildLocalWsUrl(hostname),
  enableDebugLogs: true,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
