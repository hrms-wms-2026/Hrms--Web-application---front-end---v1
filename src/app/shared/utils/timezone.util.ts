export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function dateOnlyInTimezone(isoUtc: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(isoUtc));
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

export function utcIsoToLocalParts(isoUtc: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(isoUtc));
  return {
    date: `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`,
    time: `${part(parts, 'hour')}:${part(parts, 'minute')}`
  };
}

export function localPartsToUtcIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // The whole wall clock, date included: an evening in Colombo reads as the next day from UTC, and comparing
    // hours alone would then land on the right time of the wrong day.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(candidate);
    const shown = Date.UTC(Number(part(parts, 'year')), Number(part(parts, 'month')) - 1, Number(part(parts, 'day')),
      Number(part(parts, 'hour')), Number(part(parts, 'minute')));
    const delta = shown - target;
    if (!delta) return candidate.toISOString();
    candidate = new Date(candidate.getTime() - delta);
  }
  return candidate.toISOString();
}

function part(parts: readonly Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? '00';
}
