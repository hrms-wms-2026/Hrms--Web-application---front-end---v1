import { RuntimeConfig } from '../app/core/config/runtime-config.model';

// The backend resolves tenant context purely from the request Host header
// (HostTenantResolutionMiddleware): bare "localhost" is System context (only POST /auth/login
// works there - tenant-host password login is explicitly rejected), while "{slug}.localhost" is
// Tenant context (required by every other endpoint, e.g. GET /auth/me, regardless of session
// validity). The frontend mirrors this by always calling the backend on the SAME hostname the
// Angular app itself is currently running on: on the login page that's the root domain
// (correct for POST /auth/login), and after AuthStore redirects the browser to
// "{workspace.slug}.<root>" following a fully-authenticated response, this file re-evaluates on
// that fresh page load with the tenant subdomain already in window.location.hostname.
const backendPort = 5139;

export const environment = {
  production: false,
  environmentName: 'development',
  apiUrl: `http://${window.location.hostname}:${backendPort}/api/v1`,
  wsUrl: `ws://${window.location.hostname}:${backendPort}/ws`,
  enableDebugLogs: true,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
