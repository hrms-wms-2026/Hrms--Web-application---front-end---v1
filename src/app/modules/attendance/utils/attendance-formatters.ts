export const DISPLAY_TIMEZONE_FALLBACK = 'UTC';

export function validDisplayTimezone(timezone: string | null | undefined): string | null {
  const candidate = timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

export function fullDateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** Greeting is based on the company's local wall-clock hour (via `timezone`), not the
 * browser's own timezone, so it reads correctly for remote employees in a different zone. */
export function greetingForTime(now: Date, timezone: string | null | undefined): string {
  const displayTimezone = validDisplayTimezone(timezone) ?? DISPLAY_TIMEZONE_FALLBACK;
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: displayTimezone }).format(now));
  } catch {
    hour = now.getHours();
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDateTime(value: string | null, timezone?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const displayTimezone = validDisplayTimezone(timezone);
  if (!displayTimezone) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: displayTimezone
    }).format(date);
  } catch {
    // Invalid runtime timezone data must not surface a technical error to users.
    return '—';
  }
}

/** Clock time with AM/PM, used on the attendance detail drawer. */
export function formatClockTime(value: string | null, timezone?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const displayTimezone = validDisplayTimezone(timezone);
  if (!displayTimezone) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: displayTimezone
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatMinutes(value: number | null): string {
  if (value == null || value < 0) {
    return '—';
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function humanizeValue(value: string, knownValues: Record<string, string>): string {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (knownValues[normalized]) {
    return knownValues[normalized];
  }
  if (!normalized) {
    return 'Not specified';
  }
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusLabel(value: string, backendLabel?: string | null): string {
  const label = backendLabel?.trim();
  if (label) {
    if (label.toLowerCase() === 'over break allowance') {
      return 'Over break';
    }
    return label.replace(/over break allowance/gi, 'Over break');
  }

  return humanizeValue(value, {
    not_clocked_in: 'Not clocked in',
    clocked_in: 'Clocked in',
    on_break: 'On break',
    over_break: 'Over break',
    over_break_allowance: 'Over break',
    clocked_out: 'Clocked out',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    off_day: 'Off day'
  });
}

export function workModeLabel(value: string | null): string {
  return value ? humanizeValue(value, { onsite: 'Onsite', remote: 'Remote', hybrid: 'Hybrid', field: 'Field' }) : 'Not specified';
}

export function sourceLabel(value: string | null): string {
  return value ? humanizeValue(value, { web: 'Web', desktop_tray: 'Desktop tray', biometric: 'Biometric' }) : '—';
}

export function timelineEventLabel(eventType: string): string {
  switch (eventType) {
    case 'ClockIn': return 'Clocked in';
    case 'ClockOut': return 'Clocked out';
    case 'BreakStart': return 'Break started';
    case 'BreakEnd': return 'Break ended';
    default: return eventType;
  }
}

/** Mirrors the tray app's own WorkLocationViewModel.FormatFixText convention (coordinates to 5
 * decimal places, accuracy in whole metres) so the same fix reads identically on both ends. */
export function checkInLocationLabel(
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null,
  address: string | null
): string {
  const trimmedAddress = address?.trim();
  if (trimmedAddress) {
    return trimmedAddress;
  }
  if (latitude == null || longitude == null) {
    return 'Location unavailable';
  }
  const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return accuracy != null ? `${coords} (±${Math.round(accuracy)} m)` : coords;
}

export function formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
  const displayTimezone = validDisplayTimezone(timezone);
  if (!displayTimezone || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const [year, month, day] = value.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  } catch {
    return formatDate(value);
  }
}

export function localDateTimeToIso(workDate: string, time: string, timezone: string): string | null {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite) || hour > 23 || minute > 59) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(candidate);
    const shownHour = Number(parts.find((part) => part.type === 'hour')?.value);
    const shownMinute = Number(parts.find((part) => part.type === 'minute')?.value);
    const delta = ((shownHour * 60 + shownMinute) - (hour * 60 + minute)) * 60_000;
    if (!delta) return candidate.toISOString();
    candidate = new Date(candidate.getTime() - delta);
  }
  return candidate.toISOString();
}

export function dateOnlyForZone(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

