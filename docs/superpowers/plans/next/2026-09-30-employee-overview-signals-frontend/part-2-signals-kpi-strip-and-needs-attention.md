# Employee Overview Frontend — Part 2: Signals-Driven KPI Strip & Needs Attention

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 4 KPI cards show the most important active violations (falling back to healthy baselines), and Needs Attention lists every active violation in rank order — hidden entirely when there are none.

**Architecture:** The Overview tab owns one `createWidgetLoader` for `GET /overview/signals` and passes the list into two new presentational components: `app-overview-kpi-strip` (fill logic in a pure `buildKpiCards()`) and `app-overview-needs-attention`. The four hardcoded KPI cards are removed from `overview-productivity-discipline-chart`, and the hardcoded Needs Attention block + its `@let` plumbing are removed from `overview-tab.component.ts`.

**Tech Stack:** Angular 21 standalone + signals, Tailwind classes (match the existing pastel card styles), Vitest.

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-09-30-employee-overview-signals-and-period-correctness-design.md` (Section 4).

**Depends on:** frontend Part 1 committed; backend Part 2 (`/overview/signals`) for live data (unit tests mock the API).

## Global Constraints

- Same pre-flight as Part 1: people `feature/employee-detail/`, `ui/overview-*`, `shared/ui/widget-card/` must be clean in `git status`; re-read files before editing.
- Order = the array order the API returns (already rank-sorted). Never re-sort on the client.
- KPI strip **always 4 cards**: top active signals first, then baselines in this order: `days_attended`, `tasks_completed`, `on_time_delivery`, `leave_days`. A baseline whose key would duplicate a shown signal is still allowed (different metric).
- Needs Attention renders **nothing** (no wrapper) when the list is empty or the signals load failed.
- Severity → colour only: `critical` red, `warning` amber, `info` blue; baselines emerald/slate.
- Commit attribution: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Model + API method

**Files:**
- Modify: `src/app/modules/people/models/employee-overview.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts` (after `getOverviewApprovals`)
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces — Produces:**
```ts
export type EmployeeSignalSeverity = 'critical' | 'warning' | 'info';
export type EmployeeSignalCategory = 'attendance' | 'work' | 'approvals' | 'monitoring';
export interface EmployeeSignal {
  readonly key: string;
  readonly rank: number;
  readonly severity: EmployeeSignalSeverity;
  readonly category: EmployeeSignalCategory;
  readonly value: number;
  readonly unit: 'days' | 'minutes' | 'count' | 'percent';
  readonly denominator: number | null;
  readonly label: string;
  readonly detail: string;
}
export interface EmployeeOverviewSignalsResponse {
  readonly from: string;
  readonly to: string;
  readonly signals: readonly EmployeeSignal[];
}
// PeopleApiService
getOverviewSignals(employeeId: string, from: string, to: string): Observable<EmployeeOverviewSignalsResponse>;
```

- [ ] **Step 1: Failing test** (mirror the existing `getOverviewApprovals` test in the spec — `HttpTestingController`):
```ts
it('getOverviewSignals GETs /employees/{id}/overview/signals with the period', () => {
  service.getOverviewSignals('emp-1', '2026-09-01', '2026-09-30').subscribe();
  const req = http.expectOne((r) => r.url.endsWith('/employees/emp-1/overview/signals'));
  expect(req.request.params.get('from')).toBe('2026-09-01');
  expect(req.request.params.get('to')).toBe('2026-09-30');
  req.flush({ from: '2026-09-01', to: '2026-09-30', signals: [] });
});
```
- [ ] **Step 2:** `npx ng test --include="src/app/modules/people/data-access/people-api.service.spec.ts" --watch=false` → fails.
- [ ] **Step 3: Implement**
```ts
  getOverviewSignals(employeeId: string, from: string, to: string): Observable<EmployeeOverviewSignalsResponse> {
    return this.http.get<EmployeeOverviewSignalsResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/signals`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }
```
- [ ] **Step 4:** green. **Commit** — `feat(people): overview signals model and API method`.

---

### Task 2: `buildKpiCards` + `app-overview-kpi-strip`

**Files:**
- Create: `src/app/modules/people/utils/overview-kpi-cards.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.ts` (+ `.spec.ts`)

**Interfaces — Produces:**
```ts
export type KpiTone = 'critical' | 'warning' | 'info' | 'baseline';
export interface KpiCard {
  readonly key: string;
  readonly tone: KpiTone;
  readonly label: string;       // 'Days attended', or the signal label without its leading number
  readonly value: number;
  readonly denominator: number | null;
  readonly suffix: string;      // '', 'min', '%'
  readonly detail: string;
  readonly polarity: 'higher-better' | 'lower-better';  // used by Part 3 deltas
}
export function buildKpiCards(
  signals: readonly EmployeeSignal[],
  attendance: EmployeeAttendanceOverviewResponse | null,
  work: EmployeeWorkOverviewResponse | null
): readonly KpiCard[];   // always length 4
// component: selector 'app-overview-kpi-strip', inputs: cards = input.required<readonly KpiCard[]>(), deltas = input<readonly (Delta | null)[]>([])
```

- [ ] **Step 1: Failing tests** (`overview-kpi-cards.spec.ts`):
```ts
const sig = (key: string, rank: number, severity: EmployeeSignal['severity'] = 'warning'): EmployeeSignal =>
  ({ key, rank, severity, category: 'attendance', value: 2, unit: 'count', denominator: 10, label: `2 ${key}`, detail: 'd' });
const att = { from: '', to: '', workingDays: 22, present: 18, late: 0, missingClockOuts: 0, leaveDays: 1, days: [] };
const work = { from: '', to: '', assigned: 6, completed: 1, inProgress: 2, overdue: 1, notStarted: 2, completionRatePercent: 17, onTimeRatePercent: 50 };

it('no signals -> four baselines in fixed order', () => {
  expect(buildKpiCards([], att, work).map((c) => c.key)).toEqual(['days_attended', 'tasks_completed', 'on_time_delivery', 'leave_days']);
});
it('two signals -> signals first, then first two baselines', () => {
  const cards = buildKpiCards([sig('over_break', 3), sig('late_clock_ins', 4)], att, work);
  expect(cards.map((c) => c.key)).toEqual(['over_break', 'late_clock_ins', 'days_attended', 'tasks_completed']);
  expect(cards[0].tone).toBe('warning');
});
it('five signals -> first four only, API order kept', () => {
  const keys = ['absent_days', 'missing_clock_outs', 'over_break', 'late_clock_ins', 'early_clock_outs'];
  expect(buildKpiCards(keys.map((k, i) => sig(k, i + 1)), att, work).map((c) => c.key)).toEqual(keys.slice(0, 4));
});
it('days attended baseline uses present / workingDays', () => {
  const c = buildKpiCards([], att, work)[0];
  expect([c.value, c.denominator]).toEqual([18, 22]);
});
it('missing sources still yield four cards with zeros', () => {
  expect(buildKpiCards([], null, null)).toHaveLength(4);
});
it('over_break card shows minutes under a short title', () => {
  const s = { ...sig('over_break', 3), unit: 'minutes' as const, value: 40, denominator: 2 };
  expect(buildKpiCards([s], att, work)[0]).toMatchObject({ label: 'Over-break', value: 40, suffix: 'min', denominator: null });
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement `buildKpiCards`**
```ts
/** Short card titles; the API's `label` ("40 min over break allowance") is a sentence for Needs Attention rows. */
const SIGNAL_TITLES: Record<string, string> = {
  absent_days: 'Absent days', missing_clock_outs: 'Missing clock-outs', over_break: 'Over-break',
  late_clock_ins: 'Late arrivals', early_clock_outs: 'Early clock-outs', short_hours_days: 'Short-hours days',
  location_violations: 'Location alerts', overdue_tasks: 'Overdue tasks', pending_approvals: 'Pending approvals',
  off_schedule_work: 'Off-schedule work', idle_activity_alerts: 'Idle alerts', monitoring_exceptions: 'Monitoring exceptions'
};

export function buildKpiCards(
  signals: readonly EmployeeSignal[],
  attendance: EmployeeAttendanceOverviewResponse | null,
  work: EmployeeWorkOverviewResponse | null
): readonly KpiCard[] {
  const fromSignal = (s: EmployeeSignal): KpiCard => ({
    key: s.key, tone: s.severity,
    label: SIGNAL_TITLES[s.key] ?? s.label,
    value: s.value,
    denominator: s.unit === 'minutes' ? null : s.denominator,
    suffix: s.unit === 'minutes' ? 'min' : s.unit === 'percent' ? '%' : '',
    detail: s.detail, polarity: 'lower-better'
  });
  const baselines: KpiCard[] = [
    { key: 'days_attended', tone: 'baseline', label: 'Days attended', value: attendance?.present ?? 0,
      denominator: attendance?.workingDays ?? 0, suffix: '', polarity: 'higher-better',
      detail: attendance && attendance.workingDays > 0 ? `${Math.round((attendance.present / attendance.workingDays) * 100)}% of working days` : 'No working days yet' },
    { key: 'tasks_completed', tone: 'baseline', label: 'Tasks completed', value: work?.completed ?? 0,
      denominator: work?.assigned ?? 0, suffix: '', polarity: 'higher-better',
      detail: `${work?.completionRatePercent ?? 0}% completion rate` },
    { key: 'on_time_delivery', tone: 'baseline', label: 'On-time delivery', value: work?.onTimeRatePercent ?? 0,
      denominator: null, suffix: '%', polarity: 'higher-better', detail: 'Completed by due date' },
    { key: 'leave_days', tone: 'baseline', label: 'Leave days', value: attendance?.leaveDays ?? 0,
      denominator: null, suffix: '', polarity: 'lower-better', detail: 'Approved time off this month' }
  ];
  return [...signals.slice(0, 4).map(fromSignal), ...baselines].slice(0, 4);
}
```
- [ ] **Step 4: Component** — `@for (card of cards(); track card.key; let i = $index)` renders the same pastel card markup the chart component uses today (copy the classes from the existing "Days attended" card in `overview-productivity-discipline-chart.component.ts`), with tone → classes map:
```ts
readonly toneClass: Record<KpiTone, string> = {
  critical: 'bg-red-50 border-red-100 text-red-600',
  warning: 'bg-amber-50 border-amber-100 text-amber-600',
  info: 'bg-blue-50 border-blue-100 text-blue-600',
  baseline: 'bg-emerald-50 border-emerald-100 text-emerald-600'
};
```
Value line: `{{ card.value }}{{ card.suffix }}` plus `@if (card.denominator !== null) { <span>/{{ card.denominator }}</span> }`; below it `<app-delta-badge [delta]="deltas()[i] ?? null" />` (renders nothing for null). Grid `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`, each card `data-testid="kpi-card"`.
Component spec: renders 4 `[data-testid=kpi-card]`; first card has the critical class when given a critical signal card.
- [ ] **Step 5:** run both specs → green. **Commit** — `feat(people): signal-driven KPI strip`.

---

### Task 3: `app-overview-needs-attention`

**Files:**
- Create: `src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.ts` (+ `.spec.ts`)

**Interfaces:** selector `app-overview-needs-attention`, `signals = input.required<readonly EmployeeSignal[]>()`, `deltas = input<readonly (Delta | null)[]>([])`.

- [ ] **Step 1: Failing spec**
```ts
it('renders nothing when there are no signals', () => {
  fixture.componentRef.setInput('signals', []);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="needs-attention"]')).toBeNull();
});
it('renders one row per signal in the given order with the item count', () => {
  fixture.componentRef.setInput('signals', [sig('absent_days', 1, 'critical'), sig('pending_approvals', 9, 'info')]);
  fixture.detectChanges();
  const rows = [...fixture.nativeElement.querySelectorAll('[data-testid="attention-row"]')];
  expect(rows.map((r: HTMLElement) => r.dataset['key'])).toEqual(['absent_days', 'pending_approvals']);
  expect(fixture.nativeElement.textContent).toContain('2 items');
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement** — move the card chrome (yellow `rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5` header with warning icon + "Needs Attention" + count chip) from `overview-tab.component.ts` into this component, wrapped in `@if (signals().length > 0) { <div data-testid="needs-attention"> … </div> }`. Body:
```html
@for (s of signals(); track s.key; let i = $index) {
  <div class="py-3 flex items-center justify-between" data-testid="attention-row" [attr.data-key]="s.key">
    <div class="flex items-center gap-3">
      <span class="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" [class]="dotClass[s.severity]">{{ icon[s.category] }}</span>
      <div>
        <p class="font-bold text-slate-900 text-xs">{{ s.label }}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">{{ s.detail }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <app-delta-badge [delta]="deltas()[i] ?? null" />
      <span class="px-2 py-0.5 rounded text-[11px] font-semibold" [class]="chipClass[s.severity]">{{ chipText[s.severity] }}</span>
    </div>
  </div>
}
```
with `dotClass = { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' }`, `chipClass = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-blue-100 text-blue-700' }`, `chipText = { critical: 'Urgent', warning: 'Warning', info: 'Review' }`, `icon = { attendance: '⏱', work: '!', approvals: '✓', monitoring: '◉' }`.
- [ ] **Step 4:** green. **Commit** — `feat(people): ranked Needs Attention card, hidden when empty`.

---

### Task 4: Wire into the Overview tab, remove hardcoded blocks

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/overview-tab.component.ts`
- Modify: `src/app/modules/people/ui/overview-productivity-discipline-chart/overview-productivity-discipline-chart.component.ts` (+ spec)
- Modify: `overview-tab.component.spec.ts`, `overview-tab.layout.spec.ts` (add `getOverviewSignals: vi.fn(() => of({ from: '', to: '', signals: [] }))` to the API mock)

- [ ] **Step 1: Tab** — add
```ts
  private readonly api = inject(PeopleApiService);
  readonly signalsLoader = createWidgetLoader(() =>
    this.api.getOverviewSignals(this.employeeId(), this.store.from(), this.store.to()).pipe(
      map((r) => r.signals), catchError(() => of([] as readonly EmployeeSignal[]))));
  readonly signals = computed(() => this.signalsLoader.data() ?? []);
```
Template, at the top of the left column above the chart:
```html
<app-overview-kpi-strip class="block mb-6"
  [cards]="kpiCards(signals(), attendanceWidget.loader.data() ?? null, workWidget.loader.data() ?? null)" />
```
(`protected readonly kpiCards = buildKpiCards;`). **No reshuffle:** wrap it so the strip renders only once all three sources have settled, and 4 grey skeleton cards (`animate-pulse rounded-2xl bg-slate-100 h-36`, `data-testid="kpi-skeleton"`) before that:
```ts
  protected settled(...states: WidgetState[]): boolean {
    return states.every((s) => s !== 'loading');
  }
```
```html
@if (settled(signalsLoader.state(), attendanceWidget.loader.state(), workWidget.loader.state())) { <app-overview-kpi-strip … /> }
@else { <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">@for (i of [0,1,2,3]; track i) { <div data-testid="kpi-skeleton" class="animate-pulse rounded-2xl bg-slate-100 h-36"></div> }</div> }
```
Needs Attention likewise renders only when `signalsLoader.state() !== 'loading'`. In the right column replace the whole hardcoded Needs Attention block **and** its `@let wData/aData/apData/...` lines with `<app-overview-needs-attention [signals]="signals()" />`. Add imports.
- [ ] **Step 2: Chart** — delete the 4-card KPI grid (the block rendering "Days attended", "Late arrivals", "Missing clock-outs", "Tasks completed") and any computed fields used only by it; keep the trend chart. Update the chart spec to drop assertions about those cards.
- [ ] **Step 2b: Full-month `days` list** — after backend Part 1, `/overview/attendance` `days` contains **every** date of the month (`none` = pre-hire / future / today-not-yet, `off` = weekend/holiday, `absent`), not only dates with rows. Re-read `ui/overview-attendance-widget` (its day strip) and the chart's weekly-cohort code (`getWeekDays` in `overview-productivity-discipline-chart`), then:
  - Attendance widget day strip: render only `absent | present | late | missing_clock_out | leave` days — filter out `none` and `off` — so it doesn't show 30 empty cells. Add a spec: a 30-day list with 22 `off/none` entries renders 8 cells.
  - Chart weekly cohorts: the attendance-discipline percentage per week = `(present + late + missing_clock_out) / (days that are not off/none/leave)`; weeks with zero such days plot as a gap, not 0%. Add a spec for a week that is entirely pre-hire.
- [ ] **Step 3: Tab spec** — tests: (a) while `getOverviewSignals` has not emitted (use a `Subject`), 4 `[data-testid=kpi-skeleton]` render and no kpi cards; (a2) with signals `[]` the tab renders `app-overview-kpi-strip` with 4 cards and no `[data-testid=needs-attention]`; (b) with two signals the first KPI card is the first signal and Needs Attention has 2 rows; (c) `getOverviewSignals` is called with `('emp-1', from, to)`.
- [ ] **Step 4:** `npx ng test --include="src/app/modules/people/**/*.spec.ts" --watch=false` + `npx ng build` → paste raw totals. **Commit** — `feat(people): overview KPI strip and Needs Attention driven by ranked signals`.
