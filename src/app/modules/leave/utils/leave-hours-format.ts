import { isValidTimezone, utcIsoToLocalParts } from '../../../shared/utils/timezone.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Display hours with at most two decimals; do not round values stored in state. */
export function formatHours(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Number(value.toFixed(2)));
}

export function formatHoursLabel(hours: number): string {
  return `${formatHours(hours)}h`;
}

export function formatLeaveDateTime(iso: string, timezone?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tz = timezone && isValidTimezone(timezone) ? timezone : 'UTC';
  try {
    const { date: ymd, time } = utcIsoToLocalParts(iso, tz);
    const [, month, day] = ymd.split('-');
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${time}`;
  } catch {
    return iso;
  }
}

export function formatLeaveRange(startAt: string, endAt: string, timezone?: string | null): string {
  return `${formatLeaveDateTime(startAt, timezone)} → ${formatLeaveDateTime(endAt, timezone)}`;
}

export function formatDaysAtWorkDayHours(entitledHours: number, workDayHours: number): string {
  return `${formatHours(entitledHours / workDayHours)} days at ${workDayHours.toFixed(1)}h/day`;
}
