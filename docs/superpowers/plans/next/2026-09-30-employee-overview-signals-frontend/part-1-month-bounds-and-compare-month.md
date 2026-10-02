# Employee Overview Frontend — Part 1: Month Bounds & User-Picked Compare Month

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Overview month stepper/picker only offers months from the employee's hire month to the current month (or termination month), and Compare lets the user pick which month to compare against.

**Architecture:** `EmployeePeriodStore` gains `minMonth/maxMonth` bounds and `compareMonth: string | null` (replacing `compare: 'none' | 'previous'`). The Overview tab receives `hireDate`/`terminationDate` inputs from the employee detail page and calls `setBounds`. Both pickers read bounded option lists from the store. Consuming the compare month in widgets is Part 2.

**Tech Stack:** Angular 21 standalone + signals, `@ngrx/signals` signalStore, Vitest (`vi.fn()`), `npx ng test --include=<spec> --watch=false`.

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-09-30-employee-overview-signals-and-period-correctness-design.md` (Sections 2–3).

**Backend dependency:** `jobInformation.terminationDate` and the new attendance fields come from backend Part 1 (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-09-30-employee-overview-signals-backend/part-1-expected-working-days.md`). The frontend compiles without it (fields typed nullable / optional-safe).

## Global Constraints

- Repo `C:\onevoNew\Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`.
- **Before starting:** `git status` must show no uncommitted changes in `src/app/modules/people/feature/employee-detail/`, `src/app/modules/people/ui/overview-*`, `src/app/shared/ui/widget-card/`. On 2026-09-30 another session had uncommitted work there (incl. the then-untracked `overview-productivity-discipline-chart/`). If still dirty, stop and ask the user. Re-read every file below before editing — do not trust line numbers.
- Month keys are `'YYYY-MM'` strings; they compare correctly with `<`/`>`.
- Bounds: `min = hire month`, `max = min(current month, termination month)`. In-bounds months with no data stay selectable.
- Commit attribution: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Month utils

**Files:**
- Modify: `src/app/modules/people/utils/employee-overview.utils.ts`
- Test: `src/app/modules/people/utils/employee-overview.utils.spec.ts`

**Interfaces — Produces:**
```ts
export function monthKeyOf(isoDate: string): string;                 // '2024-02-01' -> '2024-02'
export function shiftMonth(month: string, delta: number): string;   // ('2026-01', -1) -> '2025-12'
export function monthsBetween(min: string, max: string): readonly { value: string; label: string }[]; // newest first, inclusive
```

- [ ] **Step 1: Failing tests** (append):
```ts
describe('month range helpers', () => {
  it('monthKeyOf takes the YYYY-MM prefix', () => expect(monthKeyOf('2024-02-01')).toBe('2024-02'));
  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
  it('monthsBetween is inclusive and newest first', () => {
    expect(monthsBetween('2026-07', '2026-09').map((m) => m.value)).toEqual(['2026-09', '2026-08', '2026-07']);
  });
  it('monthsBetween is empty when inverted', () => expect(monthsBetween('2026-10', '2026-09')).toEqual([]));
});
```
- [ ] **Step 2:** `npx ng test --include="src/app/modules/people/utils/employee-overview.utils.spec.ts" --watch=false` → fails (not exported).
- [ ] **Step 3: Implement**
```ts
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return currentMonthKey(new Date(year, monthNumber - 1 + delta, 1));
}

/** Inclusive, newest first. */
export function monthsBetween(min: string, max: string): readonly { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  for (let m = max; m >= min; m = shiftMonth(m, -1)) months.push({ value: m, label: monthLabel(m) });
  return months;
}
```
- [ ] **Step 4:** re-run → green. **Step 5: Commit** — `feat(people): month range helpers for the overview period`.

---

### Task 2: `EmployeePeriodStore` bounds + compare month

**Files:**
- Modify: `src/app/modules/people/state/employee-period.store.ts`
- Rewrite: `src/app/modules/people/state/employee-period.store.compare.spec.ts`
- Modify: `src/app/modules/people/state/employee-period.store.spec.ts`

**Interfaces — Produces (Parts 2–3 rely on these):**
```ts
state: { month: string; compareMonth: string | null; minMonth: string | null; maxMonth: string | null }
computed: from, to, label, compareFrom (string|null), compareTo (string|null), compareLabel (string|null),
          isComparing (boolean), canGoPrevious, canGoNext,
          monthOptions (readonly {value,label}[]), compareOptions (monthOptions minus month),
          comparePrevious  // DEPRECATED: always false; removed in Part 2
methods: setBounds(hireDate: string | null, terminationDate: string | null, now?: Date), setMonth(m), previousMonth(), nextMonth(),
         setCompareMonth(m: string | null), toggleCompare()
```
`EmployeeCompareMode` type and `setCompare` are removed.

- [ ] **Step 1: Failing tests** — replace `employee-period.store.compare.spec.ts` with:
```ts
import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore bounds & compare month', () => {
  let store: InstanceType<typeof EmployeePeriodStore>;
  const now = new Date(2026, 8, 30); // Sep 2026

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    store = TestBed.inject(EmployeePeriodStore);
    store.setBounds('2026-06-15', null, now);
  });

  it('defaults to the max month and lists only in-bounds months', () => {
    expect(store.month()).toBe('2026-09');
    expect(store.monthOptions().map((o) => o.value)).toEqual(['2026-09', '2026-08', '2026-07', '2026-06']);
  });

  it('disables stepping past the edges', () => {
    expect(store.canGoNext()).toBe(false);
    store.setMonth('2026-06');
    expect(store.canGoPrevious()).toBe(false);
    store.previousMonth();
    expect(store.month()).toBe('2026-06');
  });

  it('ignores out-of-bounds months', () => {
    store.setMonth('2026-05');
    expect(store.month()).toBe('2026-09');
  });

  it('termination month caps the range', () => {
    store.setBounds('2026-06-15', '2026-08-10', now);
    expect(store.month()).toBe('2026-08');
    expect(store.canGoNext()).toBe(false);
  });

  it('toggleCompare defaults to the previous month and exposes its bounds', () => {
    store.toggleCompare();
    expect(store.compareMonth()).toBe('2026-08');
    expect(store.compareFrom()).toBe('2026-08-01');
    expect(store.compareTo()).toBe('2026-08-31');
    store.toggleCompare();
    expect(store.compareMonth()).toBeNull();
  });

  it('toggleCompare on the first month compares with the next one', () => {
    store.setMonth('2026-06');
    store.toggleCompare();
    expect(store.compareMonth()).toBe('2026-07');
  });

  it('rejects comparing a month with itself or out of bounds', () => {
    store.setCompareMonth('2026-09');
    expect(store.compareMonth()).toBeNull();
    store.setCompareMonth('2025-01');
    expect(store.compareMonth()).toBeNull();
  });

  it('clears the compare month when the selected month moves onto it', () => {
    store.setCompareMonth('2026-08');
    store.setMonth('2026-08');
    expect(store.compareMonth()).toBeNull();
  });

  it('compareOptions excludes the selected month', () => {
    expect(store.compareOptions().map((o) => o.value)).not.toContain('2026-09');
  });
});
```
In `employee-period.store.spec.ts`, delete tests that reference `compare`/`setCompare`/`'previous'`; keep month/from/to tests.

- [ ] **Step 2:** run both store specs → fail.
- [ ] **Step 3: Implement**
```ts
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { currentMonthKey, monthBounds, monthKeyOf, monthLabel, monthsBetween, shiftMonth } from '../utils/employee-overview.utils';

export interface EmployeePeriodState {
  /** 'YYYY-MM' */
  readonly month: string;
  readonly compareMonth: string | null;
  readonly minMonth: string | null;
  readonly maxMonth: string | null;
}

const inBounds = (m: string, min: string | null, max: string | null) => (!min || m >= min) && (!max || m <= max);

/**
 * The month, its bounds (hire month .. current/termination month) and the optional user-picked
 * comparison month every period-aware Overview widget reads. Provided per Overview tab instance.
 */
export const EmployeePeriodStore = signalStore(
  withState<EmployeePeriodState>({ month: currentMonthKey(), compareMonth: null, minMonth: null, maxMonth: null }),
  withComputed(({ month, compareMonth, minMonth, maxMonth }) => {
    const monthOptions = computed(() =>
      minMonth() && maxMonth() ? monthsBetween(minMonth()!, maxMonth()!) : [{ value: month(), label: monthLabel(month()) }]
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
      compareOptions: computed(() => monthOptions().filter((o) => o.value !== month())),
      /** @deprecated Backend "previous period" compare is no longer used; removed in Part 2. */
      comparePrevious: computed(() => false)
    };
  }),
  withMethods((store) => {
    const setMonth = (month: string): void => {
      if (!inBounds(month, store.minMonth(), store.maxMonth())) return;
      patchState(store, { month, compareMonth: store.compareMonth() === month ? null : store.compareMonth() });
    };
    return {
      setBounds(hireDate: string | null, terminationDate: string | null, now: Date = new Date()): void {
        const current = currentMonthKey(now);
        const minMonth = hireDate ? monthKeyOf(hireDate) : null;
        const termMonth = terminationDate ? monthKeyOf(terminationDate) : null;
        const maxMonth = termMonth && termMonth < current ? termMonth : current;
        const month = inBounds(store.month(), minMonth, maxMonth) ? store.month() : maxMonth;
        const cm = store.compareMonth();
        patchState(store, {
          minMonth, maxMonth, month,
          compareMonth: cm && cm !== month && inBounds(cm, minMonth, maxMonth) ? cm : null
        });
      },
      setMonth,
      previousMonth: () => setMonth(shiftMonth(store.month(), -1)),
      nextMonth: () => setMonth(shiftMonth(store.month(), 1)),
      setCompareMonth(compareMonth: string | null): void {
        if (compareMonth === null) return patchState(store, { compareMonth: null });
        if (compareMonth === store.month() || !inBounds(compareMonth, store.minMonth(), store.maxMonth())) return;
        patchState(store, { compareMonth });
      },
      toggleCompare(): void {
        if (store.compareMonth()) return patchState(store, { compareMonth: null });
        const prev = shiftMonth(store.month(), -1);
        const next = shiftMonth(store.month(), 1);
        const pick = inBounds(prev, store.minMonth(), store.maxMonth()) ? prev
          : inBounds(next, store.minMonth(), store.maxMonth()) ? next : null;
        patchState(store, { compareMonth: pick });
      }
    };
  })
);
```
- [ ] **Step 4:** run store specs → green. Then `npx ng build` — fix every compile error from removed `compare`/`setCompare`/`EmployeeCompareMode` (expected: `employee-compare-picker`, `overview-tab.component.ts`); those files are rewritten in Task 3, so do Task 3 before committing if the build breaks.
- [ ] **Step 5: Commit** (after Task 3 builds) — `feat(people): bounded overview months and user-picked compare month`.

---

### Task 3: Wire bounds + pickers into the Overview

**Files:**
- Modify: `src/app/modules/people/models/employee.model.ts` (`EmployeeDetailJobInformation`: add `readonly terminationDate?: string | null;`)
- Modify: `src/app/modules/people/models/employee-overview.model.ts` (`EmployeeAttendanceOverviewResponse`: add `readonly absent?: number; readonly shortHours?: number; readonly workedOnNonWorkingDay?: number; readonly workedDuringTimeOff?: number;`)
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts` (the `<app-employee-overview-tab>` tag)
- Modify: `src/app/modules/people/feature/employee-detail/overview-tab.component.ts`
- Rewrite: `src/app/modules/people/ui/employee-compare-picker/employee-compare-picker.component.ts` (+ its spec)
- Modify: `src/app/modules/people/ui/employee-period-picker/employee-period-picker.component.ts` (+ its spec)

- [ ] **Step 1: Detail page** — `<app-employee-overview-tab [employeeId]="employee.id" [hireDate]="employee.jobInformation.hireDate" [terminationDate]="employee.jobInformation.terminationDate ?? null" />`.
- [ ] **Step 2: Overview tab** — add inputs and an effect; replace the hand-rolled `previousMonth/nextMonth/toggleCompare/selectedMonthLabel` with store calls:
```ts
  readonly hireDate = input<string | null>(null);
  readonly terminationDate = input<string | null>(null);

  constructor() {
    effect(() => this.store.setBounds(this.hireDate(), this.terminationDate()));
  }
```
Template: stepper buttons `(click)="store.previousMonth()" [disabled]="!store.canGoPrevious()"` / `(click)="store.nextMonth()" [disabled]="!store.canGoNext()"` with `disabled:opacity-40 disabled:cursor-not-allowed`; label `{{ store.label() }}`; Compare button `(click)="store.toggleCompare()"`, active styling bound to `store.isComparing()`, `[disabled]="store.compareOptions().length === 0"`. Move `<app-employee-compare-picker />` **out of** the `sr-only` block and render it right after the Compare button inside `@if (store.isComparing())`. Keep `<app-employee-period-picker />` where it is.
- [ ] **Step 3: Pickers**
```ts
// employee-compare-picker.component.ts
@Component({
  selector: 'app-employee-compare-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `<app-select ariaLabel="Compare with" [options]="store.compareOptions()" [value]="store.compareMonth() ?? ''" (valueChange)="store.setCompareMonth($event)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeComparePickerComponent {
  protected readonly store = inject(EmployeePeriodStore);
}
```
Period picker: `[options]="store.monthOptions()"`, drop `recentMonths` import and the `options` field.
Spec updates: compare-picker spec asserts options = `compareOptions()` and selecting calls `setCompareMonth`; period-picker spec asserts options come from `monthOptions()` after `store.setBounds('2026-07-01', null, new Date(2026, 8, 30))` (3 options).
- [ ] **Step 4: Tab spec** — in `overview-tab.component.spec.ts` add (pin the clock so the test doesn't expire next month): `beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30)); })`, `afterEach(() => vi.useRealTimers())`; with `hireDate='2026-09-03'` set via `fixture.componentRef.setInput`, the previous-month button is `disabled` and the next-month button is `disabled`. Faking only `Date` keeps RxJS/zone timers real. In `overview-tab.layout.spec.ts`, replace the test `switching comparison on refetches only the comparison-capable widgets, with compare=true` with a placeholder-free test: clicking Compare renders `app-employee-compare-picker` (Part 2 adds the refetch assertions).
- [ ] **Step 5:** `npx ng test --include="src/app/modules/people/**/*.spec.ts" --watch=false` and `npx ng build` → paste raw totals. **Commit** — `feat(people): overview month stepper bounded to employment, compare month picker`.
