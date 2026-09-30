import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { currentMonthKey, monthBounds, monthLabel } from '../utils/employee-overview.utils';

export type EmployeeCompareMode = 'none' | 'previous';

export interface EmployeePeriodState {
  /** 'YYYY-MM' */
  readonly month: string;
  readonly compare: EmployeeCompareMode;
}

/**
 * The month (and optional previous-period comparison) every period-aware Overview widget reads.
 * Deliberately not providedIn: 'root' - the Overview tab provides its own instance so the selection
 * resets per employee page.
 */
export const EmployeePeriodStore = signalStore(
  withState<EmployeePeriodState>({ month: currentMonthKey(), compare: 'none' }),
  withComputed(({ month, compare }) => ({
    from: computed(() => monthBounds(month()).from),
    to: computed(() => monthBounds(month()).to),
    label: computed(() => monthLabel(month())),
    comparePrevious: computed(() => compare() === 'previous')
  })),
  withMethods((store) => ({
    setMonth(month: string): void {
      patchState(store, { month });
    },
    setCompare(compare: EmployeeCompareMode): void {
      patchState(store, { compare });
    }
  }))
);
