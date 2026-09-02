const ACTIVATION_PATH = '/device/activate';

export function parseSafeReturnPath(value: string | null): string | null {
  if (!value || value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (parsed.origin !== window.location.origin || parsed.pathname !== ACTIVATION_PATH) return null;
  const requestIds = parsed.searchParams.getAll('request_id');
  const userCodes = parsed.searchParams.getAll('user_code');
  if (requestIds.length !== 1 || userCodes.length !== 1 || !requestIds[0] || !userCodes[0]) return null;
  if ([...parsed.searchParams.keys()].some(key => !['request_id', 'user_code'].includes(key))) return null;
  return `${ACTIVATION_PATH}?request_id=${encodeURIComponent(requestIds[0])}&user_code=${encodeURIComponent(userCodes[0])}`;
}

export function appendReturnPath(continueUrl: string, returnPath: string | null): string {
  const safe = parseSafeReturnPath(returnPath);
  if (!safe) return continueUrl;
  const url = new URL(continueUrl, window.location.origin);
  url.searchParams.set('return_path', safe);
  return url.toString();
}
