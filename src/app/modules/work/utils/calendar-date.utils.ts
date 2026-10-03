const DAY_MS = 24 * 60 * 60 * 1000;

export function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(value: string, days: number): string {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

export function calendarDayDifference(from: string, to: string): number {
  return Math.round((parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime()) / DAY_MS);
}

export function calendarRange(startDate: string, endDate: string): string[] {
  const days = Math.max(1, calendarDayDifference(startDate, endDate) + 1);
  return Array.from({ length: days }, (_, index) => addCalendarDays(startDate, index));
}

/**
 * Position of an inclusive date range as left/width percentages within a window.
 * Clamped to [0, 100]. Used for the coloured "in event" sub-segment on a module bar.
 */
export function rangeToPercent(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): { leftPct: number; widthPct: number } {
  const total = calendarDayDifference(windowStart, windowEnd) + 1;
  if (total <= 0) return { leftPct: 0, widthPct: 0 };
  const rawLeft = (calendarDayDifference(windowStart, start) / total) * 100;
  const rawWidth = ((calendarDayDifference(start, end) + 1) / total) * 100;
  const leftPct = Math.min(100, Math.max(0, rawLeft));
  const widthPct = Math.min(100 - leftPct, Math.max(0, rawWidth));
  return { leftPct, widthPct };
}
