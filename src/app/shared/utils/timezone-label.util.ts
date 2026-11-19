/** "GMT+05:30"-style offset of an IANA zone at the given instant (so DST is respected).
 * Falls back to the raw zone id when the runtime doesn't know the zone. */
export function gmtOffsetLabel(timezone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(at);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/** "Asia/Colombo (GMT+05:30)" - the zone id readable, with its current offset. */
export function timezoneDisplayLabel(timezone: string, at: Date = new Date()): string {
  const name = timezone.replace(/_/g, ' ');
  const offset = gmtOffsetLabel(timezone, at);
  return offset === timezone ? name : `${name} (${offset})`;
}
