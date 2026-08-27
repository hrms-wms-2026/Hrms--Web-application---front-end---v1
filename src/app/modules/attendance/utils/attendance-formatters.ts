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

export function formatMinutes(value: number | null): string {
  if (value === null || value < 0) {
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
    return label;
  }

  return humanizeValue(value, {
    not_clocked_in: 'Not clocked in',
    clocked_in: 'Clocked in',
    on_break: 'On break',
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
