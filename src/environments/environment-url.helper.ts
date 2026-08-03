/**
 * Pure, testable helpers for deriving backend origin URLs.
 *
 * `buildApiUrl`/`buildWsUrl`/`resolveWsProtocol` are generic same-origin builders used by
 * production/staging, where the backend must be reached on whatever scheme/host the SPA itself is
 * served on, with no fixed port (see environment.prod.ts / environment.staging.ts).
 *
 * `buildLocalApiUrl`/`buildLocalWsUrl` are for local development only. Local development is
 * HTTPS-only (ONEVO.Api/Properties/launchSettings.json has a single "https" profile on port 7229;
 * `npm start` runs `ng serve --ssl true`) - there is no local HTTP mode and no port-switching
 * logic, so these always produce https/wss on the fixed local backend port.
 */

export function resolveWsProtocol(pageProtocol: string): string {
  return pageProtocol === 'https:' ? 'wss:' : 'ws:';
}

function buildOriginUrl(protocolWithColon: string, hostname: string, port?: number): string {
  const portSuffix = port ? `:${port}` : '';
  return `${protocolWithColon}//${hostname}${portSuffix}`;
}

export function buildApiUrl(pageProtocol: string, hostname: string, port?: number): string {
  return `${buildOriginUrl(pageProtocol, hostname, port)}/api/v1`;
}

export function buildWsUrl(pageProtocol: string, hostname: string, port?: number): string {
  return `${buildOriginUrl(resolveWsProtocol(pageProtocol), hostname, port)}/ws`;
}

const LOCAL_BACKEND_PORT = 7229;

export function buildLocalApiUrl(hostname: string): string {
  return buildApiUrl('https:', hostname, LOCAL_BACKEND_PORT);
}

export function buildLocalWsUrl(hostname: string): string {
  return buildWsUrl('https:', hostname, LOCAL_BACKEND_PORT);
}
