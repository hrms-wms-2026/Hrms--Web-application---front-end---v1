// Meetings send their start as the wall-clock time in the meeting's own zone, with that zone's offset
// (e.g. 2026-11-02T09:00:00+05:30); the server returns UTC. These helpers convert between the two.

function zoneOffsetMinutes(utcMillis: number, timeZone: string): number {
  const fields = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMillis));
  const get = (type: string) => Number(fields.find((f) => f.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMillis) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `date` YYYY-MM-DD and `time` HH:mm as wall-clock in `timeZone` -> ISO with that zone's offset on that date. */
export function toOffsetIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // The offset at the instant itself: start from the offset at the wall time, then correct once across a transition.
  let offset = zoneOffsetMinutes(wall, timeZone);
  offset = zoneOffsetMinutes(wall - offset * 60000, timeZone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** A UTC instant shown as date and time in `timeZone`. */
export function toZonedParts(utcIso: string, timeZone: string): { date: string; time: string } {
  const millis = Date.parse(utcIso);
  const local = new Date(millis + zoneOffsetMinutes(millis, timeZone) * 60000);
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
