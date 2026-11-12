const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon" from a yyyy-MM-dd date, read in UTC so no time zone can shift it. */
export function barWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Mon 26 Oct" from a yyyy-MM-dd date: a bar chart headline's title while that day is hovered. */
export function barDayTitle(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${barWeekday(iso)} ${d} ${MONTHS[m - 1] ?? ''}`.trim();
}

/** "7.5h" from minutes (one decimal, no trailing zero). */
export function barHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}
