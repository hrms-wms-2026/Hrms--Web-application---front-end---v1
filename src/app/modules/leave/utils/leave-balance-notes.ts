import { LeaveBalanceResponse } from '../models/leave-balance.model';
import { formatAmount } from './leave-amount';

/** "Accrues 8 h / month · next credit 1 Nov 2026" for monthly policies. The next-credit part only
 * shows for the current year before December; December's credit is the last one in this balance. */
export function monthlyAccrualNote(balance: LeaveBalanceResponse, today: Date): string | null {
  if (balance.amountPeriod !== 'month' || balance.amountHours == null) return null;
  const rate = `Accrues ${formatAmount(balance.amountHours, 'month')}`;
  if (balance.year !== today.getFullYear() || today.getMonth() === 11) return rate;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const label = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${rate} · next credit ${label}`;
}

/** Remaining hours as a share of entitled hours, 0-100, for the progress bars. */
export function remainingShare(balance: LeaveBalanceResponse): number {
  const total = Math.max(balance.entitledHours, 0);
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, (Math.max(balance.remainingHours, 0) / total) * 100));
}
