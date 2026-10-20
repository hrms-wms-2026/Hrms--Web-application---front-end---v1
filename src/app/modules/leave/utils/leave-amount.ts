import { LeaveAmountPeriod } from '../models/leave-policy.model';

/** "8 h", "-4.5 h": hours with at most two decimals. */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(2))} h`;
}

/** "8 h / month", "112 h / year". */
export function formatAmount(hours: number, period: LeaveAmountPeriod): string {
  return `${formatHours(hours)} / ${period}`;
}
