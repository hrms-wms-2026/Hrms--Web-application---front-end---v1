function minutes(hhmm: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm.trim())) return null;
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

export function isOvernightWorkWindow(start: string, end: string): boolean {
  const a = minutes(start);
  const b = minutes(end);
  if (a === null || b === null) return false;
  return b <= a;
}

export function computeWorkDayHours(
  start: string | null | undefined,
  end: string | null | undefined,
  breakMinutes: number | string | null | undefined
): number | null {
  if (!start || !end) return null;
  const a = minutes(start);
  const b = minutes(end);
  if (a === null || b === null) return null;
  let delta = b - a;
  if (delta <= 0) delta += 24 * 60;
  const brk = Math.max(0, Number(breakMinutes) || 0);
  return Math.round((delta - brk) / 60 * 100) / 100;
}
