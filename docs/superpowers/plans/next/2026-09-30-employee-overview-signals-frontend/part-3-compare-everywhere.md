# Employee Overview Frontend — Part 3: Compare Everything Against the Picked Month

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Compare is on, every visible Overview number shows a ▲/▼ badge against the user-picked compare month, and the trend chart draws the compare month as a second dashed series.

**Architecture:** A shared `createCompareLoader(store, load)` re-requests a widget's **existing** endpoint with `store.compareFrom()/compareTo()` (emits `null` while compare is off, so no request). Each widget exposes `readonly compareLoader` and renders `<app-delta-badge>` via the existing `computeDelta`. The tab reads widget compare loaders through its template refs to build KPI/Needs-Attention deltas, plus one compare loader for signals. Backend `compare=previous` flags are no longer sent.

**Tech Stack:** Angular 21 signals, RxJS, Vitest.

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-09-30-employee-overview-signals-and-period-correctness-design.md` (Section 3).

**Depends on:** frontend Parts 1 and 2 committed.

## Global Constraints

- Same pre-flight as Part 1 (clean `git status` on the overview files; re-read before editing).
- A delta is shown only while `store.isComparing()`; otherwise pass `null` (badge renders nothing).
- Polarity per metric is exactly the table in Task 3. Signal-derived numbers are always `lower-better`.
- A signal missing from the compare month's list counts as `0` in that month.
- `DeltaBadgeComponent` aria text says "versus the previous period" — change to "versus {compare month label}" (Task 1).
- Commit attribution: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: `createCompareLoader` + `deltaIf` + badge wording

**Files:**
- Create: `src/app/modules/people/utils/overview-compare.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/people/ui/delta-badge/delta-badge.component.ts` (+ spec)

**Interfaces — Produces:**
```ts
export function createCompareLoader<T>(
  store: InstanceType<typeof EmployeePeriodStore>,
  load: (from: string, to: string) => Observable<T>
): WidgetLoader<T | null>;
export function deltaIf(comparing: boolean, current: number | null | undefined, previous: number | null | undefined,
  polarity: DeltaPolarity, format?: (n: number) => string): Delta | null;
// DeltaBadgeComponent: new input `against = input<string | null>(null)` used in aria-label
```

- [ ] **Step 1: Failing tests**
```ts
describe('deltaIf', () => {
  it('is null when not comparing', () => expect(deltaIf(false, 5, 3, 'higher-better')).toBeNull());
  it('is null when the compare value is missing', () => expect(deltaIf(true, 5, null, 'higher-better')).toBeNull());
  it('treats a missing current value as 0', () => expect(deltaIf(true, undefined, 2, 'lower-better')!.tone).toBe('good'));
});

// Same host-component + fixture.detectChanges() pattern as shared/ui/widget-card/widget-loader.spec.ts
// (the repo does not use TestBed.flushEffects/tick).
const load = vi.fn((_from: string, _to: string) => of(1));

@Component({ standalone: true, template: '', providers: [EmployeePeriodStore] })
class HostComponent {
  readonly store = inject(EmployeePeriodStore);
  readonly loader = createCompareLoader(this.store, load);
}

describe('createCompareLoader', () => {
  it('does not call the API while compare is off and calls it with the compare bounds when on', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.store.setBounds('2026-01-01', null, new Date(2026, 8, 30));
    fixture.detectChanges();
    expect(load).not.toHaveBeenCalled();
    host.store.setCompareMonth('2026-06');
    fixture.detectChanges();
    expect(load).toHaveBeenCalledWith('2026-06-01', '2026-06-30');
    expect(host.loader.data()).toBe(1);
  });
});
```
- [ ] **Step 2:** `npx ng test --include="src/app/modules/people/utils/overview-compare.spec.ts" --watch=false` → fails.
- [ ] **Step 3: Implement**
```ts
export function createCompareLoader<T>(store: InstanceType<typeof EmployeePeriodStore>, load: (from: string, to: string) => Observable<T>): WidgetLoader<T | null> {
  return createWidgetLoader<T | null>(() => {
    const from = store.compareFrom();
    const to = store.compareTo();
    return from && to ? load(from, to).pipe(catchError(() => of(null))) : of(null);
  });
}

export function deltaIf(comparing: boolean, current: number | null | undefined, previous: number | null | undefined,
  polarity: DeltaPolarity, format: (n: number) => string = String): Delta | null {
  if (!comparing || previous === null || previous === undefined) return null;
  return computeDelta(current ?? 0, previous, polarity, format);
}
```
Badge: add `readonly against = input<string | null>(null);` and in `label` replace `the previous period` with `this.against() ?? 'the previous period'`.
- [ ] **Step 4:** green. **Commit** — `feat(people): compare-month loader and delta helper`.

---

### Task 2: Remove backend "previous" compare usage

**Files:**
- Modify: `src/app/modules/people/state/employee-period.store.ts` (delete the deprecated `comparePrevious`)
- Modify: every file the build then flags (expected: `ui/overview-activity-widget`, `ui/overview-discipline-widget`, `ui/overview-delivery-widget` — they pass `this.period.comparePrevious()` to the API)

- [ ] **Step 1:** Delete `comparePrevious`. In each flagged widget pass `false` for the compare argument and delete template branches that read `data.previous` (they are superseded by Task 3's compare loaders; these three widgets sit in the tab's `sr-only` block).
- [ ] **Step 2:** Update their specs: remove "refetches with compare=true" cases; `overview-tab.layout.spec.ts` must no longer expect any `…, true)` call.
- [ ] **Step 3:** people specs + `npx ng build` green. **Commit** — `refactor(people): drop backend previous-period compare from overview widgets`.

---

### Task 3: Deltas in every visible widget

For each widget: add `readonly compareLoader = createCompareLoader(this.period, (from, to) => <same API call as its main loader with from/to swapped in>)` (the store field may be named `period` or `store` — use the existing one), then place `<app-delta-badge [delta]="…" [against]="period.compareLabel()" />` next to the metric.

| Widget file (`src/app/modules/people/ui/…`) | Metric (current expr → compare expr) | Polarity |
|---|---|---|
| `overview-attendance-widget` | `present` | higher-better |
| | `late` | lower-better |
| | `missingClockOuts` | lower-better |
| | `leaveDays` | neutral |
| `overview-work-widget` | `completed` | higher-better |
| | `inProgress` | neutral |
| | `overdue` | lower-better |
| | `completionRatePercent` (format `n => n + '%'`) | higher-better |
| `overview-approvals-widget` (and the tab's visible "Approval Activity" card, which reads `approvalsWidget.loader`) | `pending`, `approved`, `rejected` | neutral |
| `overview-time-off-widget` | leave days taken in month: current = attendance `leaveDays` for `store.from/to`, compare = same for compare month — add a line "Leave in {{ period.label() }}: n day(s)" with the badge; balances rings stay year-based, no delta | neutral |

Delta expression pattern (attendance `late` example):
```ts
readonly lateDelta = computed(() =>
  deltaIf(this.period.isComparing(), this.loader.data()?.late, this.compareLoader.data()?.late, 'lower-better'));
```
The time-off widget needs attendance data: give it two loaders `monthLeave = createWidgetLoader(() => api.getOverviewAttendance(id, period.from(), period.to()).pipe(map(r => r.leaveDays)))` and `compareLoader = createCompareLoader(period, (f, t) => api.getOverviewAttendance(id, f, t).pipe(map(r => r.leaveDays)))`.

- [ ] **Step 1: Failing specs** — for each widget add one spec: with the store comparing `'2026-08'` and the API mock returning different values per `from`, the badge `[data-testid=delta]` shows the expected text (e.g. late 3 vs 1 → `▲ +2`, tone `bad`). Mock pattern: `getOverviewAttendance: vi.fn((_id, from) => of(from === '2026-08-01' ? prev : cur))`.
- [ ] **Step 2:** run each widget spec → fails.
- [ ] **Step 3:** implement per the table.
- [ ] **Step 4:** green. **Commit** — `feat(people): compare-month deltas on attendance, work, approvals, time off`.

---

### Task 4: KPI strip, Needs Attention and trend chart deltas

**Files:**
- Modify: `src/app/modules/people/utils/overview-kpi-cards.ts` (+ spec)
- Modify: `src/app/modules/people/feature/employee-detail/overview-tab.component.ts` (+ spec)
- Modify: `src/app/modules/people/ui/overview-productivity-discipline-chart/overview-productivity-discipline-chart.component.ts` (+ spec)

**Interfaces — Produces:**
```ts
export function kpiValue(key: string, signals: readonly EmployeeSignal[] | null,
  attendance: EmployeeAttendanceOverviewResponse | null, work: EmployeeWorkOverviewResponse | null): number | null;
// null only when the whole compare source is unavailable (signals null for a signal key, attendance/work null for a baseline)
```

- [ ] **Step 1: Failing tests** (`overview-kpi-cards.spec.ts`):
```ts
it('kpiValue reads a signal value, 0 when the signal is absent that month', () => {
  expect(kpiValue('over_break', [sig('over_break', 3)], att, work)).toBe(2);
  expect(kpiValue('over_break', [], att, work)).toBe(0);
  expect(kpiValue('over_break', null, att, work)).toBeNull();
});
it('kpiValue reads baselines', () => {
  expect(kpiValue('days_attended', [], att, work)).toBe(18);
  expect(kpiValue('tasks_completed', [], att, null)).toBeNull();
});
```
- [ ] **Step 2: Implement**
```ts
const BASELINE_READERS: Record<string, (a: EmployeeAttendanceOverviewResponse | null, w: EmployeeWorkOverviewResponse | null) => number | null> = {
  days_attended: (a) => a?.present ?? null,
  tasks_completed: (_a, w) => w?.completed ?? null,
  on_time_delivery: (_a, w) => (w ? w.onTimeRatePercent ?? 0 : null),
  leave_days: (a) => a?.leaveDays ?? null
};
export function kpiValue(
  key: string,
  signals: readonly EmployeeSignal[] | null,
  attendance: EmployeeAttendanceOverviewResponse | null,
  work: EmployeeWorkOverviewResponse | null
): number | null {
  const baseline = BASELINE_READERS[key];
  if (baseline) return baseline(attendance, work);
  if (!signals) return null;
  return signals.find((s) => s.key === key)?.value ?? 0;
}
```
- [ ] **Step 3: Tab** — add `readonly compareSignalsLoader = createCompareLoader(this.store, (f, t) => this.api.getOverviewSignals(this.employeeId(), f, t).pipe(map((r) => r.signals)));`. Compute, in the template or a method taking the widget refs:
```ts
protected kpiDeltas(cards: readonly KpiCard[], cmpAtt: EmployeeAttendanceOverviewResponse | null, cmpWork: EmployeeWorkOverviewResponse | null): (Delta | null)[] {
  return cards.map((c) => deltaIf(this.store.isComparing(), c.value,
    kpiValue(c.key, this.compareSignalsLoader.data() ?? null, cmpAtt, cmpWork), c.polarity));
}
protected attentionDeltas(): (Delta | null)[] {
  const cmp = this.compareSignalsLoader.data() ?? null;
  return this.signals().map((s) => deltaIf(this.store.isComparing(), s.value, cmp ? cmp.find((x) => x.key === s.key)?.value ?? 0 : null, 'lower-better'));
}
```
Bind `[deltas]="kpiDeltas(cards, attendanceWidget.compareLoader.data() ?? null, workWidget.compareLoader.data() ?? null)"` on the strip (store the cards in a `@let cards = kpiCards(...)`) and `[deltas]="attentionDeltas()"` on Needs Attention. Needs Attention stays hidden when the *current* month has no signals, even if the compare month had some.
- [ ] **Step 4: Chart** — add `compareLoader = createCompareLoader(this.period, (f, t) => forkJoin({ attendance: …, work: … }))` using the same calls as its main loader; run the existing weekly-cohort computation on compare data and render it as a second series with `stroke-dasharray="4 4"` and `opacity-50`; add the compare month label to the legend. Spec: with compare on, the chart renders two `polyline`/`path` series (use a `data-testid="trend-compare"` on the new one).
- [ ] **Step 5: Tab spec** — replace the old compare test: clicking Compare, then picking `'2026-08'` in the compare picker, calls `getOverviewSignals`, `getOverviewAttendance`, `getOverviewWork`, `getOverviewApprovals` with `('emp-1', '2026-08-01', '2026-08-31')`, and at least one `[data-testid=delta]` renders in the KPI strip.
- [ ] **Step 6:** `npx ng test --include="src/app/modules/people/**/*.spec.ts" --watch=false` + `npx ng build` → paste raw totals. **Commit** — `feat(people): compare-month deltas on KPI strip, Needs Attention and trend chart`.
- [ ] **Step 7: Live check (user-run)** — dev runs on `*.onexso.com`, which the in-app browser cannot load. Ask the user to open Saif Ahamed and Thivan Balasubramaniam for September 2026 and confirm: Days attended shows `x / 22`-ish (not 0/0), arrows stop at hire month, Compare → August shows badges, Needs Attention hidden for an employee with no violations.
