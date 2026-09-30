import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  currentMonthKey,
  monthBounds,
  monthKeyOf,
  monthLabel,
  monthsBetween,
  shiftMonth
} from '../utils/employee-overview.utils';

export interface EmployeePeriodState {
  /** 'YYYY-MM' */
  readonly month: string;
  readonly compareMonth: string | null;
  readonly minMonth: string | null;
  readonly maxMonth: string | null;
}

const inBounds = (month: string, min: string | null, max: string | null) =>
  (!min || month >= min) && (!max || month <= max);

/**
 * The month, its bounds (hire month .. current/termination month) and the optional user-picked
 * comparison month every period-aware Overview widget reads. Provided per Overview tab instance.
 */
export const EmployeePeriodStore = signalStore(
  withState<EmployeePeriodState>({
    month: currentMonthKey(),
    compareMonth: null,
    minMonth: null,
    maxMonth: null
  }),
  withComputed(({ month, compareMonth, minMonth, maxMonth }) => {
    const monthOptions = computed(() =>
      minMonth() && maxMonth()
        ? monthsBetween(minMonth()!, maxMonth()!)
        : [{ value: month(), label: monthLabel(month()) }]
    );

    return {
      from: computed(() => monthBounds(month()).from),
      to: computed(() => monthBounds(month()).to),
      label: computed(() => monthLabel(month())),
      isComparing: computed(() => compareMonth() !== null),
      compareFrom: computed(() => (compareMonth() ? monthBounds(compareMonth()!).from : null)),
      compareTo: computed(() => (compareMonth() ? monthBounds(compareMonth()!).to : null)),
      compareLabel: computed(() => (compareMonth() ? monthLabel(compareMonth()!) : null)),
      canGoPrevious: computed(() => !minMonth() || month() > minMonth()!),
      canGoNext: computed(() => !maxMonth() || month() < maxMonth()!),
      monthOptions,
      compareOptions: computed(() => monthOptions().filter((option) => option.value !== month())),
      /** @deprecated Backend "previous period" compare is no longer used; removed in Part 2. */
      comparePrevious: computed(() => false)
    };
  }),
  withMethods((store) => {
    const setMonth = (month: string): void => {
      if (!inBounds(month, store.minMonth(), store.maxMonth())) return;
      patchState(store, {
        month,
        compareMonth: store.compareMonth() === month ? null : store.compareMonth()
      });
    };

    return {
      setBounds(hireDate: string | null, terminationDate: string | null, now: Date = new Date()): void {
        const current = currentMonthKey(now);
        const minMonth = hireDate ? monthKeyOf(hireDate) : null;
        const terminationMonth = terminationDate ? monthKeyOf(terminationDate) : null;
        const maxMonth = terminationMonth && terminationMonth < current ? terminationMonth : current;
        const month = inBounds(store.month(), minMonth, maxMonth) ? store.month() : maxMonth;
        const compareMonth = store.compareMonth();

        patchState(store, {
          minMonth,
          maxMonth,
          month,
          compareMonth:
            compareMonth && compareMonth !== month && inBounds(compareMonth, minMonth, maxMonth)
              ? compareMonth
              : null
        });
      },
      setMonth,
      previousMonth: () => setMonth(shiftMonth(store.month(), -1)),
      nextMonth: () => setMonth(shiftMonth(store.month(), 1)),
      setCompareMonth(compareMonth: string | null): void {
        if (compareMonth === null) {
          patchState(store, { compareMonth: null });
          return;
        }
        if (compareMonth === store.month() || !inBounds(compareMonth, store.minMonth(), store.maxMonth())) return;
        patchState(store, { compareMonth });
      },
      toggleCompare(): void {
        if (store.compareMonth()) {
          patchState(store, { compareMonth: null });
          return;
        }

        const previous = shiftMonth(store.month(), -1);
        const next = shiftMonth(store.month(), 1);
        const compareMonth = inBounds(previous, store.minMonth(), store.maxMonth())
          ? previous
          : inBounds(next, store.minMonth(), store.maxMonth())
            ? next
            : null;
        patchState(store, { compareMonth });
      }
    };
  })
);
