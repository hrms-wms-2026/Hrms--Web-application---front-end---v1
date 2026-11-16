const ACTIVATION_PATH = '/device/activate';

export function parseSafeReturnPath(value: string | null): string | null {
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point (header/redirect injection guard)
  if (!value || value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (parsed.origin !== window.location.origin) return null;
  return toActivationPath(parsed);
}

function toActivationPath(parsed: URL): string | null {
  if (parsed.pathname !== ACTIVATION_PATH) return null;
  const requestIds = parsed.searchParams.getAll('request_id');
  const userCodes = parsed.searchParams.getAll('user_code');
  if (requestIds.length !== 1 || userCodes.length !== 1 || !requestIds[0] || !userCodes[0])
    return null;
  if ([...parsed.searchParams.keys()].some((key) => !['request_id', 'user_code'].includes(key)))
    return null;
  return `${ACTIVATION_PATH}?request_id=${encodeURIComponent(requestIds[0])}&user_code=${encodeURIComponent(userCodes[0])}`;
}

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point (redirect injection guard)
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Fixed parse base: only root-relative input reaches the parser, so the result can't leave it. */
const INTERNAL_BASE = 'https://app.invalid';

/**
 * General post-login returnUrl guard (the auth guard puts any in-app route here). Accepts only a
 * root-relative app path; rejects absolute/protocol-relative/external URLs, backslashes, control
 * characters and /auth/* loops. /device/activate must also pass the strict activation rules.
 */
export function toSafeInternalPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARS.test(value)
  ) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(value, INTERNAL_BASE);
  } catch {
    return null;
  }
  if (parsed.origin !== INTERNAL_BASE) return null;
  if (parsed.pathname === ACTIVATION_PATH) return toActivationPath(parsed);
  if (parsed.pathname.startsWith('/auth/')) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendReturnPath(continueUrl: string, returnPath: string | null): string {
  const safe = parseSafeReturnPath(returnPath);
  if (!safe) return continueUrl;
  const url = new URL(continueUrl, window.location.origin);
  url.searchParams.set('return_path', safe);
  return url.toString();
}
