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
