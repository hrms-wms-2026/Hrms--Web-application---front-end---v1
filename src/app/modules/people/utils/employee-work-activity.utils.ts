import { ActivityHourBucket, AttentionReason } from '../models/employee-work-activity.model';

export function attentionLabel(item: { reason: AttentionReason; overdueDays: number | null; daysUntilDue: number | null }): string {
  if (item.reason === 'overdue') {
    const d = item.overdueDays ?? 0;
    return `${d} ${d === 1 ? 'day' : 'days'} overdue`;
  }
  const d = item.daysUntilDue ?? 0;
  if (d === 0) return 'Due today';
  return `Due in ${d} ${d === 1 ? 'day' : 'days'}`;
}

export function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/** '2026-09' -> 'Sep'. */
export function shortMonth(month: string): string {
  const index = Number(month.split('-')[1]) - 1;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index] ?? month;
}

/** 9 -> '9AM', 13 -> '1PM', 0 -> '12AM'. */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'AM' : 'PM'}`;
}

/** '2:41 PM' in the given zone (or the viewer's own zone when omitted); '—' for a missing timestamp. */
export function formatClock(iso: string | null, timeZone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

/** The chart always shows 9..17 (9AM-5PM) and widens to include any hour that has activity. */
export function visibleHours(hours: readonly ActivityHourBucket[]): readonly ActivityHourBucket[] {
  const active = hours.filter((h) => h.activeMinutes > 0).map((h) => h.hour);
  const start = Math.min(9, ...active);
  const end = Math.max(17, ...active);
  return hours.filter((h) => h.hour >= start && h.hour <= end);
}
