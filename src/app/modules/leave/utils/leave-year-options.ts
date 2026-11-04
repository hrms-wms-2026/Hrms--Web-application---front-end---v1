import { SelectOption } from '../../../shared/ui/select/select.component';

/** Last year, this year and next year: the years a leave balance or holiday list can be looked at. */
export function yearOptions(today: Date = new Date()): SelectOption[] {
  const current = today.getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}
