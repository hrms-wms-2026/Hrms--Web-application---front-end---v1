/** Sources whose items are exception cases (reviewed, not approved): monitoring and calendar meeting exceptions. */
const EXCEPTION_SOURCE_KEYS: ReadonlySet<string> = new Set(['monitoring.exception', 'calendar.meeting_exception']);

export function isExceptionSource(sourceKey: string): boolean {
  return EXCEPTION_SOURCE_KEYS.has(sourceKey);
}
