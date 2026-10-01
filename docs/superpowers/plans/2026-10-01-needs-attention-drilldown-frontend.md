# Needs Attention Drill-down — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Needs Attention row (and every coloured KPI card) open a list of the concrete days / alerts / cases / tasks / approvals behind it, and open each item's existing detail view over the employee profile.

**Architecture:** A component-scoped `SignalDrilldownStore` (provided by the Overview tab next to `EmployeePeriodStore`) owns which signal is open, a per-period item cache and the selected item. `OverviewNeedsAttentionComponent` renders expandable rows and an `app-signal-items-list` under the open row; `OverviewKpiStripComponent` emits `cardSelected(key)` for coloured cards. `app-signal-item-detail` hosts the **existing** detail components — `app-attendance-detail-drawer`, `app-exception-evidence-panel` in `app-modal`, `app-task-form-modal` — chosen by item kind. The hidden Discipline widget is deleted.

**Tech Stack:** Angular 21 standalone components, signals, `@ngrx/signals` `signalStore`, Tailwind, Vitest (`vi.fn()`), `ng test`.

**Spec:** `docs/superpowers/specs/2026-10-01-needs-attention-drilldown-design.md`. Depends on the backend plan `HRMS-Backend-v1/docs/superpowers/plans/2026-10-01-needs-attention-drilldown-backend.md` (endpoint `GET /employees/{id}/overview/signals/{key}/items`). Frontend tasks are unit-tested against mocks and can run before the backend lands; Task 8's live check needs it.

## Global Constraints

- Signal content (rank, severity, label, detail) and KPI card colours/order/content (`buildKpiCards`) must not change. Missing clock-outs stays in Needs Attention.
- Item details reuse existing components only — no new drawer/modal look-alikes.
- Approvals expand inline with "Review in approvals →"; tasks open in the real, editable `app-task-form-modal`.
- One Needs Attention row open at a time; items cached per `key|from|to`; period or compare-month change clears the cache and closes the row.
- Item list cap is the backend's 50; show "+N more" when `total > items.length`.
- Links inside Overview widgets use `href` + `Router.navigateByUrl` (not `RouterLink`) so Overview specs need no `ActivatedRoute` — the pattern already used by `overview-attendance-widget`.
- Tests: Vitest (`vi.fn()`, `vi.spyOn()`), run with `npx ng test --include <path> --watch=false`.
- Shared working tree: other sessions edit these files. Stage by explicit path only; never `git add -A` / `git add .`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Change |
|---|---|
| `src/app/modules/people/models/employee-overview.model.ts` | add item types |
| `src/app/modules/people/data-access/people-api.service.ts` (+ spec) | `getOverviewSignalItems` |
| `src/app/modules/people/utils/signal-item-links.ts` (+ spec) | **new** — approval review URL, full-list URL |
| `src/app/modules/people/state/signal-drilldown.store.ts` (+ spec) | **new** |
| `src/app/modules/people/ui/signal-items-list/signal-items-list.component.ts` (+ spec) | **new** — presentational list |
| `src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.ts` (+ spec) | expandable rows |
| `src/app/modules/people/ui/signal-item-detail/signal-item-detail.component.ts` (+ spec) | **new** — hosts existing detail components |
| `src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.ts` (+ spec) | `cardSelected` |
| `src/app/modules/people/feature/employee-detail/overview-tab.component.ts` (+ specs) | wiring; drop Discipline |
| `src/app/modules/people/ui/overview-discipline-widget/` | **delete** |

---

### Task 0: Pre-flight — foreign uncommitted edits

Several files this plan edits had uncommitted changes from another session when the plan was written (`overview-needs-attention.component.ts` + spec, `overview-tab.component.ts` + 3 specs). Committing this plan's work would sweep those edits into these commits.

- [ ] **Step 1: Check**

```bash
git status --short -- src/app/modules/people/ui/overview-needs-attention src/app/modules/people/feature/employee-detail src/app/modules/people/ui/overview-kpi-strip src/app/modules/people/ui/overview-discipline-widget
```

- [ ] **Step 2: Decide**

If any listed file shows ` M` and the change is not from this plan, **stop and ask the user** whether those edits are theirs/another session's and whether to (a) wait for them to be committed, or (b) include them. Do not stash, revert or commit them on your own. If clean, continue.

---

### Task 1: Item model and API method

**Files:**
- Modify: `src/app/modules/people/models/employee-overview.model.ts` (after `EmployeeOverviewSignalsResponse`, ~line 170)
- Modify: `src/app/modules/people/data-access/people-api.service.ts` (after `getOverviewSignals`, ~line 255)
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts` (after the `getOverviewSignals` test, ~line 240)

**Interfaces:**
- Produces:

```ts
export type EmployeeSignalItemKind = 'attendance_day' | 'monitoring_alert' | 'exception_case' | 'task' | 'approval';

export interface EmployeeSignalItem {
  readonly kind: EmployeeSignalItemKind;
  readonly id: string;              // record id; yyyy-MM-dd for attendance_day
  readonly date: string;            // yyyy-MM-dd
  readonly title: string;
  readonly subtitle: string | null;
  readonly occurredAt: string | null;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly dueDate: string | null;
  readonly approvalKind: string | null;
  readonly requestedAt: string | null;
  readonly approverName: string | null;
}

export interface EmployeeSignalItemsResponse {
  readonly key: string;
  readonly total: number;
  readonly timezone: string | null;
  readonly items: readonly EmployeeSignalItem[];
}
```

  and `PeopleApiService.getOverviewSignalItems(employeeId: string, key: string, from: string, to: string): Observable<EmployeeSignalItemsResponse>`.

- [ ] **Step 1: Write the failing test**

```ts
  it('getOverviewSignalItems GETs /employees/{id}/overview/signals/{key}/items with the period', () => {
    service.getOverviewSignalItems('emp-1', 'over_break', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/employees/emp-1/overview/signals/over_break/items'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({ key: 'over_break', total: 0, timezone: null, items: [] });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/data-access/people-api.service.spec.ts --watch=false`
Expected: FAIL — `getOverviewSignalItems` is not a function / TS error.

- [ ] **Step 3: Implement** — add the model types above to `employee-overview.model.ts`, and to `PeopleApiService` (add `EmployeeSignalItemsResponse` to its model import):

```ts
  getOverviewSignalItems(employeeId: string, key: string, from: string, to: string): Observable<EmployeeSignalItemsResponse> {
    return this.http.get<EmployeeSignalItemsResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/signals/${encodeURIComponent(key)}/items`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }
```

- [ ] **Step 4: Run to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/models/employee-overview.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat(people): signal items model and API method

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Link helpers

**Files:**
- Create: `src/app/modules/people/utils/signal-item-links.ts`
- Test: `src/app/modules/people/utils/signal-item-links.spec.ts`

**Interfaces:**
- Consumes: `EmployeeSignalItem` (Task 1).
- Produces:
  - `approvalReviewUrl(item: EmployeeSignalItem): string`
  - `signalFullListUrl(key: string, employeeId: string, from: string, to: string): string | null`
  - `taskBoardUrl(item: EmployeeSignalItem): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { EmployeeSignalItem } from '../models/employee-overview.model';
import { approvalReviewUrl, signalFullListUrl, taskBoardUrl } from './signal-item-links';

const item = (over: Partial<EmployeeSignalItem>): EmployeeSignalItem => ({
  kind: 'approval', id: 'r-1', date: '2026-09-28', title: 'Leave request', subtitle: null, occurredAt: null,
  projectId: null, projectName: null, dueDate: null, approvalKind: 'leave', requestedAt: '2026-09-28T05:00:00Z',
  approverName: null, ...over
});

describe('signal item links', () => {
  it.each([
    ['leave', '/time-off/team-approvals'],
    ['attendance_correction', '/attendance/time-tracking?view=team&type=corrections&requestId=r-1'],
    ['work_area_change', '/attendance/time-tracking?view=team&type=work-area&requestId=r-1'],
    ['location_change', '/attendance/time-tracking?view=team&type=location&requestId=r-1'],
    ['task_edit', '/work']
  ])('routes a %s approval to its inbox', (approvalKind, url) => {
    expect(approvalReviewUrl(item({ approvalKind }))).toBe(url);
  });

  it('routes attendance and location keys to the filtered Time Tracking team view', () => {
    expect(signalFullListUrl('late_clock_ins', 'emp-1', '2026-09-01', '2026-09-30'))
      .toBe('/attendance/time-tracking?view=team&employeeId=emp-1&from=2026-09-01&to=2026-09-30');
    expect(signalFullListUrl('location_violations', 'emp-1', '2026-09-01', '2026-09-30'))
      .toBe('/attendance/time-tracking?view=team&employeeId=emp-1&from=2026-09-01&to=2026-09-30');
  });

  it('routes monitoring keys to Alerts, overdue tasks to Work, and has no list for approvals', () => {
    expect(signalFullListUrl('idle_activity_alerts', 'emp-1', 'a', 'b')).toBe('/attendance/alerts');
    expect(signalFullListUrl('monitoring_exceptions', 'emp-1', 'a', 'b')).toBe('/attendance/alerts');
    expect(signalFullListUrl('overdue_tasks', 'emp-1', 'a', 'b')).toBe('/work');
    expect(signalFullListUrl('pending_approvals', 'emp-1', 'a', 'b')).toBeNull();
  });

  it('links a task to its board with the task modal open', () => {
    expect(taskBoardUrl(item({ kind: 'task', id: 't-9', projectId: 'p-2' }))).toBe('/work/p-2/board?taskId=t-9');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/utils/signal-item-links.spec.ts --watch=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { EmployeeSignalItem } from '../models/employee-overview.model';

const ATTENDANCE_KEYS = new Set([
  'absent_days', 'missing_clock_outs', 'over_break', 'late_clock_ins', 'early_clock_outs',
  'short_hours_days', 'off_schedule_work', 'location_violations'
]);

const TIME_TRACKING_APPROVAL_TYPES: Record<string, string> = {
  attendance_correction: 'corrections',
  work_area_change: 'work-area',
  location_change: 'location'
};

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

/** Where a pending approval is reviewed. Work Management approvals live per project, which the
 * item does not carry, so they go to the project list. */
export function approvalReviewUrl(item: EmployeeSignalItem): string {
  const kind = item.approvalKind ?? '';
  if (kind === 'leave') return '/time-off/team-approvals';
  const type = TIME_TRACKING_APPROVAL_TYPES[kind];
  if (type) return withQuery('/attendance/time-tracking', { view: 'team', type, requestId: item.id });
  return '/work';
}

/** The module page listing everything behind a signal, for "+N more"; null when there is none. */
export function signalFullListUrl(key: string, employeeId: string, from: string, to: string): string | null {
  if (ATTENDANCE_KEYS.has(key)) {
    return withQuery('/attendance/time-tracking', { view: 'team', employeeId, from, to });
  }
  if (key === 'idle_activity_alerts' || key === 'monitoring_exceptions') return '/attendance/alerts';
  if (key === 'overdue_tasks') return '/work';
  return null;
}

/** Board fallback when the task modal cannot load the task's project. */
export function taskBoardUrl(item: EmployeeSignalItem): string {
  return withQuery(`/work/${item.projectId}/board`, { taskId: item.id });
}
```

- [ ] **Step 4: Run to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/utils/signal-item-links.ts src/app/modules/people/utils/signal-item-links.spec.ts
git commit -m "feat(people): link helpers for signal drill-down items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `SignalDrilldownStore`

**Files:**
- Create: `src/app/modules/people/state/signal-drilldown.store.ts`
- Test: `src/app/modules/people/state/signal-drilldown.store.spec.ts`

**Interfaces:**
- Consumes: `PeopleApiService.getOverviewSignalItems` (Task 1); `EmployeePeriodStore` (`from()`, `to()`), provided by the same injector.
- Produces (component-scoped; provide it alongside `EmployeePeriodStore`):
  - signals: `openKey(): string | null`, `loadingKey(): string | null`, `errorKey(): string | null`, `openResponse(): EmployeeSignalItemsResponse | null`, `selected(): { item: EmployeeSignalItem; timezone: string | null } | null`, `employeeId(): string | null`
  - methods: `setEmployee(id: string)`, `open(key: string)`, `toggle(key: string)`, `close()`, `retry()`, `reset()`, `select(item: EmployeeSignalItem)`, `clearSelection()`

- [ ] **Step 1: Write the failing tests**

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeSignalItemsResponse } from '../models/employee-overview.model';
import { EmployeePeriodStore } from './employee-period.store';
import { SignalDrilldownStore } from './signal-drilldown.store';

describe('SignalDrilldownStore', () => {
  const response = (key: string): EmployeeSignalItemsResponse => ({ key, total: 1, timezone: 'Asia/Colombo', items: [
    { kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: 'x', occurredAt: null,
      projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null }
  ] });

  function setup(get = vi.fn((_: string, key: string) => of(response(key)))) {
    TestBed.configureTestingModule({
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems: get } }]
    });
    const period = TestBed.inject(EmployeePeriodStore);
    period.setMonth('2026-09');
    const store = TestBed.inject(SignalDrilldownStore);
    store.setEmployee('emp-1');
    return { store, period, get };
  }

  it('loads items for the opened key and the current period', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins');
    await Promise.resolve();

    expect(get).toHaveBeenCalledWith('emp-1', 'late_clock_ins', '2026-09-01', '2026-09-30');
    expect(store.openKey()).toBe('late_clock_ins');
    expect(store.openResponse()?.key).toBe('late_clock_ins');
  });

  it('serves a reopened key from cache', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    store.close();
    store.open('late_clock_ins'); await Promise.resolve();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps only one key open and toggles it closed', async () => {
    const { store } = setup();
    store.open('late_clock_ins');
    store.open('over_break');
    expect(store.openKey()).toBe('over_break');
    store.toggle('over_break');
    expect(store.openKey()).toBeNull();
  });

  it('reset clears the cache and the open key', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    store.reset();
    expect(store.openKey()).toBeNull();
    store.open('late_clock_ins'); await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('records an error for the key and retry refetches', async () => {
    const get = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(response('over_break')));
    const { store } = setup(get);
    store.open('over_break'); await Promise.resolve();
    expect(store.errorKey()).toBe('over_break');

    store.retry(); await Promise.resolve();
    expect(store.errorKey()).toBeNull();
    expect(store.openResponse()?.items).toHaveLength(1);
  });

  it('select remembers the item with the open response timezone', async () => {
    const { store } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    const item = store.openResponse()!.items[0];
    store.select(item);
    expect(store.selected()).toEqual({ item, timezone: 'Asia/Colombo' });
    store.clearSelection();
    expect(store.selected()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/state/signal-drilldown.store.spec.ts --watch=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../models/employee-overview.model';
import { EmployeePeriodStore } from './employee-period.store';

interface SignalDrilldownState {
  readonly employeeId: string | null;
  readonly openKey: string | null;
  readonly cache: Readonly<Record<string, EmployeeSignalItemsResponse>>;
  readonly loadingKey: string | null;
  readonly errorKey: string | null;
  readonly selected: { readonly item: EmployeeSignalItem; readonly timezone: string | null } | null;
}

const cacheKey = (key: string, from: string, to: string) => `${key}|${from}|${to}`;

/**
 * Needs Attention drill-down state for one Overview tab: which signal is expanded (one at a time),
 * the items fetched per signal+period, and the item whose detail is open. Provided next to the
 * tab's EmployeePeriodStore; the tab calls reset() whenever the month or comparison changes.
 */
export const SignalDrilldownStore = signalStore(
  withState<SignalDrilldownState>({
    employeeId: null, openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null
  }),
  withComputed((store, period = inject(EmployeePeriodStore)) => ({
    openResponse: computed(() => {
      const key = store.openKey();
      return key ? store.cache()[cacheKey(key, period.from(), period.to())] ?? null : null;
    })
  })),
  withMethods((store, api = inject(PeopleApiService), period = inject(EmployeePeriodStore)) => {
    async function load(key: string): Promise<void> {
      const employeeId = store.employeeId();
      const from = period.from();
      const to = period.to();
      const ck = cacheKey(key, from, to);
      if (!employeeId || store.cache()[ck]) return;
      patchState(store, { loadingKey: key, errorKey: null });
      try {
        const response = await firstValueFrom(api.getOverviewSignalItems(employeeId, key, from, to));
        patchState(store, { cache: { ...store.cache(), [ck]: response } });
        if (store.loadingKey() === key) patchState(store, { loadingKey: null });
      } catch {
        if (store.loadingKey() === key) patchState(store, { loadingKey: null, errorKey: key });
      }
    }

    function open(key: string): void {
      patchState(store, { openKey: key, errorKey: null });
      void load(key);
    }

    function close(): void {
      patchState(store, { openKey: null, errorKey: null });
    }

    return {
      setEmployee(employeeId: string): void {
        patchState(store, { employeeId, openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null });
      },
      open,
      close,
      toggle(key: string): void {
        if (store.openKey() === key) close();
        else open(key);
      },
      retry(): void {
        const key = store.openKey();
        if (key) void load(key);
      },
      reset(): void {
        patchState(store, { openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null });
      },
      select(item: EmployeeSignalItem): void {
        patchState(store, { selected: { item, timezone: store.openResponse()?.timezone ?? null } });
      },
      clearSelection(): void {
        patchState(store, { selected: null });
      }
    };
  })
);
```

- [ ] **Step 4: Run to verify it passes** — same command. Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/state/signal-drilldown.store.ts src/app/modules/people/state/signal-drilldown.store.spec.ts
git commit -m "feat(people): signal drill-down store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `app-signal-items-list`

**Files:**
- Create: `src/app/modules/people/ui/signal-items-list/signal-items-list.component.ts`
- Test: `src/app/modules/people/ui/signal-items-list/signal-items-list.component.spec.ts`

**Interfaces:**
- Consumes: `EmployeeSignalItemsResponse`, `EmployeeSignalItem` (Task 1); `approvalReviewUrl` (Task 2); `formatShortDate`, `formatEventTime` from `../../utils/employee-overview.utils`.
- Produces: selector `app-signal-items-list`; inputs `response: EmployeeSignalItemsResponse | null`, `loading: boolean`, `error: boolean`, `fullListUrl: string | null`; outputs `itemSelected: EmployeeSignalItem`, `retry: void`. Approval items do **not** emit `itemSelected`; they expand inline.

- [ ] **Step 1: Write the failing tests**

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../../models/employee-overview.model';
import { SignalItemsListComponent } from './signal-items-list.component';

const base: EmployeeSignalItem = {
  kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: '35 min over allowance',
  occurredAt: null, projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null
};
const res = (items: EmployeeSignalItem[], total = items.length): EmployeeSignalItemsResponse =>
  ({ key: 'k', total, timezone: 'Asia/Colombo', items });

function setup(inputs: { response?: EmployeeSignalItemsResponse | null; loading?: boolean; error?: boolean; fullListUrl?: string | null }) {
  TestBed.configureTestingModule({ imports: [SignalItemsListComponent] });
  const fixture = TestBed.createComponent(SignalItemsListComponent);
  fixture.componentRef.setInput('response', inputs.response ?? null);
  fixture.componentRef.setInput('loading', inputs.loading ?? false);
  fixture.componentRef.setInput('error', inputs.error ?? false);
  fixture.componentRef.setInput('fullListUrl', inputs.fullListUrl ?? null);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('SignalItemsListComponent', () => {
  it('shows skeleton rows while loading', () => {
    const { el } = setup({ loading: true });
    expect(el.querySelectorAll('[data-testid="signal-items-skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows an error with a retry button that emits retry', () => {
    const { fixture, el } = setup({ error: true });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    (el.querySelector('[data-testid="signal-items-retry"]') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalled();
  });

  it('renders day items and emits itemSelected on click', () => {
    const { fixture, el } = setup({ response: res([base]) });
    const selected = vi.fn();
    fixture.componentInstance.itemSelected.subscribe(selected);
    const row = el.querySelector('[data-testid="signal-item"]') as HTMLButtonElement;
    expect(row.textContent).toContain('Wed 2 Sep');
    expect(row.textContent).toContain('35 min over allowance');
    row.click();
    expect(selected).toHaveBeenCalledWith(base);
  });

  it('groups tasks under their project with a count', () => {
    const t = (id: string, project: string, projectName: string): EmployeeSignalItem =>
      ({ ...base, kind: 'task', id, title: `Task ${id}`, projectId: project, projectName, dueDate: '2026-09-10', subtitle: projectName });
    const { el } = setup({ response: res([t('1', 'p1', 'Apollo'), t('2', 'p2', 'Zeus'), t('3', 'p1', 'Apollo')]) });
    const groups = Array.from(el.querySelectorAll('[data-testid="signal-task-group"]'));
    expect(groups.map((g) => g.querySelector('[data-testid="signal-task-group-name"]')!.textContent!.trim()))
      .toEqual(['Apollo (2)', 'Zeus (1)']);
  });

  it('expands an approval inline with a review link instead of emitting itemSelected', () => {
    const approval: EmployeeSignalItem = { ...base, kind: 'approval', id: 'r-1', title: 'Leave request',
      subtitle: 'Annual · 2026-10-03 → 2026-10-05', approvalKind: 'leave', requestedAt: '2026-09-28T05:00:00Z' };
    const { fixture, el } = setup({ response: res([approval]) });
    const selected = vi.fn();
    fixture.componentInstance.itemSelected.subscribe(selected);

    (el.querySelector('[data-testid="signal-item"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(selected).not.toHaveBeenCalled();
    const review = el.querySelector('[data-testid="approval-review-link"]') as HTMLAnchorElement;
    expect(review.getAttribute('href')).toBe('/time-off/team-approvals');
  });

  it('shows "+N more" with the full-list link when the list is capped', () => {
    const { el } = setup({ response: res([base], 57), fullListUrl: '/attendance/alerts' });
    const more = el.querySelector('[data-testid="signal-items-more"]') as HTMLAnchorElement;
    expect(more.textContent).toContain('+56 more');
    expect(more.getAttribute('href')).toBe('/attendance/alerts');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/ui/signal-items-list --watch=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../../models/employee-overview.model';
import { formatEventTime, formatShortDate } from '../../utils/employee-overview.utils';
import { approvalReviewUrl } from '../../utils/signal-item-links';

interface TaskGroup { readonly projectName: string; readonly items: readonly EmployeeSignalItem[]; }

/** The items behind one Needs Attention signal. Presentational: the parent owns loading and
 * selection; approvals expand inline (no shared approval detail view exists). */
@Component({
  selector: 'app-signal-items-list',
  standalone: true,
  template: `
    <div class="mt-2 rounded-xl border border-amber-200/70 bg-white/70 p-2" data-testid="signal-items">
      @if (loading()) {
        @for (i of [0, 1, 2]; track i) {
          <div data-testid="signal-items-skeleton" class="my-1 h-7 animate-pulse rounded bg-slate-100"></div>
        }
      } @else if (error()) {
        <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-600" role="alert">
          <span>Could not load these items.</span>
          <button type="button" data-testid="signal-items-retry" class="font-semibold text-blue-600 hover:underline" (click)="retry.emit()">Retry</button>
        </div>
      } @else if (response(); as r) {
        @if (isTasks()) {
          @for (group of taskGroups(); track group.projectName) {
            <div data-testid="signal-task-group" class="py-1">
              <p data-testid="signal-task-group-name" class="px-2 text-[11px] font-bold text-slate-700">{{ group.projectName }} ({{ group.items.length }})</p>
              @for (item of group.items; track item.id) {
                <button type="button" data-testid="signal-item" class="item-row" (click)="itemSelected.emit(item)">
                  <span class="truncate">{{ item.title }}</span>
                  <span class="shrink-0 text-slate-400">due {{ short(item.dueDate) }} ›</span>
                </button>
              }
            </div>
          }
        } @else {
          @for (item of r.items; track item.kind + item.id) {
            <button type="button" data-testid="signal-item" class="item-row" (click)="onItemClick(item)"
                    [attr.aria-expanded]="item.kind === 'approval' ? openApprovalId() === item.id : null">
              <span class="min-w-0 truncate">
                <span class="font-semibold text-slate-800">{{ item.title }}</span>
                @if (item.occurredAt) { <span class="text-slate-400"> · {{ time(item.occurredAt, r.timezone) }}</span> }
                @if (item.subtitle) { <span class="text-slate-500"> · {{ item.subtitle }}</span> }
              </span>
              <span class="shrink-0 text-slate-400">{{ item.kind === 'approval' ? (openApprovalId() === item.id ? '▾' : '▸') : '›' }}</span>
            </button>
            @if (item.kind === 'approval' && openApprovalId() === item.id) {
              <div class="mx-2 mb-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600" data-testid="approval-detail">
                @if (item.requestedAt) { <p>Requested {{ short(item.requestedAt) }}</p> }
                @if (item.approverName) { <p>Waiting on {{ item.approverName }}</p> }
                <a data-testid="approval-review-link" class="mt-1 inline-block font-semibold text-blue-600 hover:underline"
                   [href]="reviewUrl(item)" (click)="navigate($event, reviewUrl(item))">Review in approvals →</a>
              </div>
            }
          }
        }
        @if (r.total > r.items.length && fullListUrl(); as url) {
          <a data-testid="signal-items-more" class="block px-2 py-1.5 text-[11px] font-semibold text-blue-600 hover:underline"
             [href]="url" (click)="navigate($event, url)">+{{ r.total - r.items.length }} more · open full list</a>
        }
      }
    </div>
  `,
  styles: [`
    .item-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 0.5rem;
      border-radius: 0.5rem; padding: 0.375rem 0.5rem; text-align: left; font-size: 11px; cursor: pointer; }
    .item-row:hover { background: rgb(248 250 252); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalItemsListComponent {
  private readonly router = inject(Router);

  readonly response = input<EmployeeSignalItemsResponse | null>(null);
  readonly loading = input(false);
  readonly error = input(false);
  readonly fullListUrl = input<string | null>(null);
  readonly itemSelected = output<EmployeeSignalItem>();
  readonly retry = output<void>();

  readonly openApprovalId = signal<string | null>(null);
  readonly isTasks = computed(() => this.response()?.items[0]?.kind === 'task');
  readonly taskGroups = computed<readonly TaskGroup[]>(() => {
    const groups = new Map<string, EmployeeSignalItem[]>();
    for (const item of this.response()?.items ?? []) {
      const name = item.projectName ?? 'No project';
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    return [...groups.entries()].map(([projectName, items]) => ({ projectName, items }));
  });

  readonly reviewUrl = approvalReviewUrl;

  onItemClick(item: EmployeeSignalItem): void {
    if (item.kind === 'approval') {
      this.openApprovalId.update((id) => (id === item.id ? null : item.id));
      return;
    }
    this.itemSelected.emit(item);
  }

  short(iso: string | null): string {
    return iso ? formatShortDate(iso.slice(0, 10)) : '';
  }

  time(iso: string, timeZone: string | null): string {
    return formatEventTime(iso, timeZone ?? undefined);
  }

  navigate(event: MouseEvent, url: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigateByUrl(url);
  }
}
```

Before Step 4, open `src/app/modules/people/utils/employee-overview.utils.ts` and confirm the signatures `formatShortDate(iso: string): string` and `formatEventTime(iso: string, timeZone?: string): string` (lines ~118 and ~124). If `formatShortDate` expects a full ISO timestamp rather than `yyyy-MM-dd`, pass `iso` unsliced.

- [ ] **Step 4: Run to verify it passes** — same command. Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/signal-items-list/signal-items-list.component.ts src/app/modules/people/ui/signal-items-list/signal-items-list.component.spec.ts
git commit -m "feat(people): signal items list for the Needs Attention drill-down

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Expandable Needs Attention rows

**Files:**
- Modify: `src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.ts`
- Test: `src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.spec.ts`

**Interfaces:**
- Consumes: `SignalDrilldownStore` (Task 3), `SignalItemsListComponent` (Task 4), `signalFullListUrl` (Task 2), `EmployeePeriodStore`.
- Produces: rows are `<button data-testid="attention-row" [attr.data-key]>` with `aria-expanded`; the open row is followed by `app-signal-items-list`. Requires `SignalDrilldownStore` and `EmployeePeriodStore` from an ancestor injector.

- [ ] **Step 1: Update the spec harness and add failing tests**

In the existing spec, change `setup` so the component gets the stores (keep every existing test as is):

```ts
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';

  const getItems = vi.fn((_: string, key: string) => of({ key, total: 1, timezone: null, items: [
    { kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: 'late', occurredAt: null,
      projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null }
  ] }));

  function setup(signals: readonly EmployeeSignal[]) {
    TestBed.configureTestingModule({
      imports: [OverviewNeedsAttentionComponent],
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems: getItems } }]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    TestBed.inject(SignalDrilldownStore).setEmployee('emp-1');
    const fixture = TestBed.createComponent(OverviewNeedsAttentionComponent);
    fixture.componentRef.setInput('signals', signals);
    fixture.detectChanges();
    return fixture;
  }
```

Add `beforeEach(() => getItems.mockClear());` and these tests:

```ts
  it('expands a row into its items and collapses it on a second click', async () => {
    const fixture = setup([signal('late_clock_ins', 4, 'warning')]);
    const row = fixture.nativeElement.querySelector('[data-testid="attention-row"]') as HTMLButtonElement;

    row.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(getItems).toHaveBeenCalledWith('emp-1', 'late_clock_ins', '2026-09-01', '2026-09-30');
    expect(fixture.nativeElement.querySelector('app-signal-items-list')).toBeTruthy();

    row.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-signal-items-list')).toBeNull();
  });

  it('keeps only one row open', () => {
    const fixture = setup([signal('absent_days', 1, 'critical'), signal('late_clock_ins', 4, 'warning')]);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="attention-row"]') as NodeListOf<HTMLButtonElement>;
    rows[0].click();
    rows[1].click();
    fixture.detectChanges();

    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('app-signal-items-list')).toHaveLength(1);
  });

  it('switches to View all when a row beyond the first three is opened from outside', () => {
    const fixture = setup([
      signal('absent_days', 1, 'critical'), signal('missing_clock_outs', 2, 'critical'),
      signal('over_break', 3, 'warning'), signal('late_clock_ins', 4, 'warning')
    ]);
    TestBed.inject(SignalDrilldownStore).open('late_clock_ins');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="late_clock_ins"]')).toBeTruthy();
  });

  it('selecting an item stores it on the drill-down store', async () => {
    const fixture = setup([signal('late_clock_ins', 4, 'warning')]);
    (fixture.nativeElement.querySelector('[data-testid="attention-row"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="signal-item"]') as HTMLButtonElement).click();

    expect(TestBed.inject(SignalDrilldownStore).selected()?.item.id).toBe('2026-09-02');
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx ng test --include src/app/modules/people/ui/overview-needs-attention --watch=false`
Expected: the 4 new tests FAIL (rows are `<div>`s with no expand behaviour); existing tests PASS.

- [ ] **Step 3: Implement** — edit the component **in place** (keep `collapsedLimit`, `expand()`, `onToggleClick`, the class maps and the card-level click as they are on disk):

1. Imports: add `effect, inject` to the Angular import, and

```ts
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { signalFullListUrl } from '../../utils/signal-item-links';
import { SignalItemsListComponent } from '../signal-items-list/signal-items-list.component';
```

   and `imports: [DeltaBadgeComponent, SignalItemsListComponent]`.

2. Replace the row `<div ... data-testid="attention-row" ...>` opening tag and its closing `</div>` with a button, and render the list after it:

```html
          @for (signal of displayedSignals(); track signal.key; let i = $index) {
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 py-3 text-left cursor-pointer"
              data-testid="attention-row"
              [attr.data-key]="signal.key"
              [attr.aria-expanded]="drilldown.openKey() === signal.key"
              (click)="onRowClick($event, signal.key)"
            >
              <!-- existing row content unchanged; add a chevron as the last child of the right-hand group: -->
            </button>
            @if (drilldown.openKey() === signal.key) {
              <app-signal-items-list
                (click)="$event.stopPropagation()"
                [response]="drilldown.openResponse()"
                [loading]="drilldown.loadingKey() === signal.key"
                [error]="drilldown.errorKey() === signal.key"
                [fullListUrl]="fullListUrl(signal.key)"
                (itemSelected)="drilldown.select($event)"
                (retry)="drilldown.retry()"
              />
            }
          }
```

   Inside the right-hand `<div class="flex shrink-0 items-center gap-2">`, after the severity chip, add:
   `<span class="text-slate-400" aria-hidden="true">{{ drilldown.openKey() === signal.key ? '▾' : '▸' }}</span>`

3. Class additions:

```ts
  protected readonly drilldown = inject(SignalDrilldownStore);
  private readonly period = inject(EmployeePeriodStore);

  constructor() {
    // A row opened from outside (a KPI card) that sits beyond the collapsed limit forces View all.
    effect(() => {
      const key = this.drilldown.openKey();
      if (!key) return;
      const index = this.signals().findIndex((s) => s.key === key);
      if (index >= this.collapsedLimit) this.showAll.set(true);
    });
  }

  onRowClick(event: Event, key: string): void {
    event.stopPropagation();
    this.drilldown.toggle(key);
  }

  fullListUrl(key: string): string | null {
    const employeeId = this.drilldown.employeeId();
    return employeeId ? signalFullListUrl(key, employeeId, this.period.from(), this.period.to()) : null;
  }
```

- [ ] **Step 4: Run to verify all pass** — same command. Expected: all PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.ts src/app/modules/people/ui/overview-needs-attention/overview-needs-attention.component.spec.ts
git commit -m "feat(people): expandable Needs Attention rows with item drill-down

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `app-signal-item-detail` — reuse existing detail components

**Files:**
- Create: `src/app/modules/people/ui/signal-item-detail/signal-item-detail.component.ts`
- Test: `src/app/modules/people/ui/signal-item-detail/signal-item-detail.component.spec.ts`

**Interfaces:**
- Consumes: `SignalDrilldownStore.selected()/clearSelection()` (Task 3); `taskBoardUrl` (Task 2); existing components:
  - `AttendanceDetailDrawerComponent` — `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.ts`, inputs `selection: { employeeId; workDate } | null`, `displayTimezone: string`, output `closed`. `requestCorrection` is deliberately not bound.
  - `ExceptionEvidencePanelComponent` — `src/app/modules/attendance/feature/exception-alerts/exception-evidence-panel/exception-evidence-panel.component.ts`, input `alertId` (the exception case id).
  - `ModalComponent` — `src/app/shared/ui/modal/modal.component.ts`, inputs `open`, `title`, `size`, output `closed`.
  - `TaskFormModalComponent` — `src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts`, inputs `open`, `mode`, `projectId`, `taskId`, outputs `closed`, `saved`.
  - `ProjectDetailStore` (root) — `loadProject(id)`, `loadMyMilestones(id)`, `projectError()`. The task modal reads `project` and `milestones` from it, as on the board.
- Produces: selector `app-signal-item-detail`, input `employeeId: string`; output `changed: void` (a task was saved — the tab refetches signals).

- [ ] **Step 1: Write the failing tests** — stub the heavy reused components so the spec tests wiring only:

```ts
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttendanceDetailDrawerComponent } from '../../../attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component';
import { ExceptionEvidencePanelComponent } from '../../../attendance/feature/exception-alerts/exception-evidence-panel/exception-evidence-panel.component';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeSignalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { SignalItemDetailComponent } from './signal-item-detail.component';

@Component({ selector: 'app-attendance-detail-drawer', standalone: true, template: '' })
class DrawerStub { selection = input<unknown>(null); displayTimezone = input('UTC'); fallbackSummary = input<unknown>(null); closed = output<void>(); }
@Component({ selector: 'app-exception-evidence-panel', standalone: true, template: '' })
class EvidenceStub { alertId = input.required<string>(); }
@Component({ selector: 'app-task-form-modal', standalone: true, template: '' })
class TaskModalStub { open = input(false); mode = input('create'); projectId = input.required<string>(); taskId = input(''); closed = output<void>(); saved = output<void>(); }

const item = (over: Partial<EmployeeSignalItem>): EmployeeSignalItem => ({
  kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: null, occurredAt: null,
  projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null, ...over
});

describe('SignalItemDetailComponent', () => {
  const project = { loadProject: vi.fn(() => Promise.resolve()), loadMyMilestones: vi.fn(() => Promise.resolve()), projectError: vi.fn(() => null as string | null) };

  async function setup(selected: EmployeeSignalItem, timezone: string | null = 'Asia/Colombo') {
    const getOverviewSignalItems = vi.fn(() => of({ key: 'k', total: 1, timezone, items: [selected] }));
    TestBed.configureTestingModule({
      imports: [SignalItemDetailComponent],
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems } },
        { provide: ProjectDetailStore, useValue: project }]
    }).overrideComponent(SignalItemDetailComponent, {
      remove: { imports: [AttendanceDetailDrawerComponent, ExceptionEvidencePanelComponent, TaskFormModalComponent] },
      add: { imports: [DrawerStub, EvidenceStub, TaskModalStub] }
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const store = TestBed.inject(SignalDrilldownStore);
    store.setEmployee('emp-1');
    // Drive the real store: open a signal, let its items load, then select the item.
    store.open('k');
    await Promise.resolve();
    store.select(selected);
    const fixture = TestBed.createComponent(SignalItemDetailComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => { project.loadProject.mockClear(); project.loadMyMilestones.mockClear(); project.projectError.mockReturnValue(null); });

  it('opens the attendance drawer for a day with employee, date and timezone', async () => {
    const { fixture } = await setup(item({}));
    const drawer = fixture.debugElement.query((d) => d.componentInstance instanceof DrawerStub).componentInstance as DrawerStub;
    expect(drawer.selection()).toEqual({ employeeId: 'emp-1', workDate: '2026-09-02' });
    expect(drawer.displayTimezone()).toBe('Asia/Colombo');
  });

  it('opens the same drawer for a monitoring alert on its date', async () => {
    const { fixture } = await setup(item({ kind: 'monitoring_alert', id: 'n-1', date: '2026-09-05' }));
    const drawer = fixture.debugElement.query((d) => d.componentInstance instanceof DrawerStub).componentInstance as DrawerStub;
    expect(drawer.selection()).toEqual({ employeeId: 'emp-1', workDate: '2026-09-05' });
  });

  it('shows exception evidence in a modal for an exception case', async () => {
    const { fixture } = await setup(item({ kind: 'exception_case', id: 'x-1' }));
    const evidence = fixture.debugElement.query((d) => d.componentInstance instanceof EvidenceStub).componentInstance as EvidenceStub;
    expect(evidence.alertId()).toBe('x-1');
  });

  it('loads the project then opens the task modal in edit mode', async () => {
    const { fixture } = await setup(item({ kind: 'task', id: 't-1', projectId: 'p-1', projectName: 'Apollo' }));
    expect(project.loadProject).toHaveBeenCalledWith('p-1');
    expect(project.loadMyMilestones).toHaveBeenCalledWith('p-1');
    const modal = fixture.debugElement.query((d) => d.componentInstance instanceof TaskModalStub).componentInstance as TaskModalStub;
    expect(modal.open()).toBe(true);
    expect(modal.mode()).toBe('edit');
    expect(modal.projectId()).toBe('p-1');
    expect(modal.taskId()).toBe('t-1');
  });

  it('falls back to an Open on board link when the project cannot be loaded', async () => {
    project.projectError.mockReturnValue('Forbidden');
    const { el } = await setup(item({ kind: 'task', id: 't-1', projectId: 'p-1' }));
    expect(el.querySelector('app-task-form-modal')).toBeNull();
    expect((el.querySelector('[data-testid="task-board-fallback"]') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/work/p-1/board?taskId=t-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/ui/signal-item-detail --watch=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AttendanceDetailDrawerComponent } from '../../../attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component';
import { ExceptionEvidencePanelComponent } from '../../../attendance/feature/exception-alerts/exception-evidence-panel/exception-evidence-panel.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { taskBoardUrl } from '../../utils/signal-item-links';

/**
 * Opens the selected Needs Attention item in the component that already shows that thing
 * elsewhere: the Time Tracking day drawer (days and alerts), the Alerts evidence panel (exception
 * cases) and the board's task form modal (tasks). Approvals never reach here - they expand inline.
 */
@Component({
  selector: 'app-signal-item-detail',
  standalone: true,
  imports: [AttendanceDetailDrawerComponent, ExceptionEvidencePanelComponent, ModalComponent, TaskFormModalComponent],
  template: `
    @if (selected(); as s) {
      @switch (s.item.kind) {
        @case ('attendance_day') {
          <app-attendance-detail-drawer [selection]="daySelection()" [displayTimezone]="s.timezone ?? 'UTC'" (closed)="close()" />
        }
        @case ('monitoring_alert') {
          <app-attendance-detail-drawer [selection]="daySelection()" [displayTimezone]="s.timezone ?? 'UTC'" (closed)="close()" />
        }
        @case ('exception_case') {
          <app-modal [open]="true" [title]="s.item.title" size="lg" (closed)="close()">
            <app-exception-evidence-panel [alertId]="s.item.id" />
          </app-modal>
        }
        @case ('task') {
          @if (taskState() === 'ready') {
            <app-task-form-modal [open]="true" mode="edit" [projectId]="s.item.projectId!" [taskId]="s.item.id"
                                 (saved)="changed.emit()" (closed)="close()" />
          } @else if (taskState() === 'failed') {
            <app-modal [open]="true" [title]="s.item.title" size="sm" (closed)="close()">
              <p class="text-sm text-slate-600">This task's project could not be opened here.</p>
              <a data-testid="task-board-fallback" class="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline"
                 [href]="boardUrl()" (click)="openBoard($event)">Open on board →</a>
            </app-modal>
          }
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalItemDetailComponent {
  private readonly drilldown = inject(SignalDrilldownStore);
  private readonly projects = inject(ProjectDetailStore);
  private readonly router = inject(Router);

  readonly employeeId = input.required<string>();
  readonly changed = output<void>();

  protected readonly selected = computed(() => this.drilldown.selected());
  protected readonly daySelection = computed(() => {
    const s = this.selected();
    return s ? { employeeId: this.employeeId(), workDate: s.item.date } : null;
  });
  protected readonly taskState = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly boardUrl = computed(() => {
    const s = this.selected();
    return s?.item.kind === 'task' ? taskBoardUrl(s.item) : '';
  });

  constructor() {
    // The task modal reads project + milestones from the root ProjectDetailStore (as on the board).
    effect(() => {
      const s = this.selected();
      if (s?.item.kind !== 'task' || !s.item.projectId) return;
      const projectId = s.item.projectId;
      untracked(() => {
        this.taskState.set('loading');
        void (async () => {
          await this.projects.loadProject(projectId);
          if (this.projects.projectError()) { this.taskState.set('failed'); return; }
          await this.projects.loadMyMilestones(projectId);
          this.taskState.set('ready');
        })();
      });
    });
  }

  close(): void {
    this.drilldown.clearSelection();
  }

  openBoard(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.close();
    void this.router.navigateByUrl(this.boardUrl());
  }
}
```

Note: `projectError` in `ProjectDetailStore` is a state signal (`patchState(store, { projectError: ... })` in `loadProject`); confirm the selector name in `src/app/modules/work/state/project-detail.store.ts` before running.

- [ ] **Step 4: Run to verify it passes** — same command. Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/signal-item-detail/signal-item-detail.component.ts src/app/modules/people/ui/signal-item-detail/signal-item-detail.component.spec.ts
git commit -m "feat(people): open drill-down items in their existing detail views

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Clickable coloured KPI cards

**Files:**
- Modify: `src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.ts`
- Test: `src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.spec.ts` (create if absent)

**Interfaces:**
- Produces: output `cardSelected: string` (the card's signal key), emitted only for cards whose `tone !== 'baseline'`. Visual classes unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { KpiCard } from '../../utils/overview-kpi-cards';
import { OverviewKpiStripComponent } from './overview-kpi-strip.component';

const card = (key: string, tone: KpiCard['tone']): KpiCard =>
  ({ key, tone, label: key, value: 2, denominator: null, suffix: '', detail: 'd', polarity: 'lower-better' });

describe('OverviewKpiStripComponent card selection', () => {
  function setup(cards: KpiCard[]) {
    TestBed.configureTestingModule({ imports: [OverviewKpiStripComponent] });
    const fixture = TestBed.createComponent(OverviewKpiStripComponent);
    fixture.componentRef.setInput('cards', cards);
    fixture.detectChanges();
    return fixture;
  }

  it('emits the key for a coloured (signal) card and nothing for a baseline card', () => {
    const fixture = setup([card('over_break', 'warning'), card('days_attended', 'baseline')]);
    const selected = vi.fn();
    fixture.componentInstance.cardSelected.subscribe(selected);
    const cards = fixture.nativeElement.querySelectorAll('[data-testid="kpi-card"]') as NodeListOf<HTMLElement>;

    cards[0].click();
    cards[1].click();

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith('over_break');
    expect(cards[0].getAttribute('role')).toBe('button');
    expect(cards[1].getAttribute('role')).toBeNull();
  });

  it('keeps the tone classes unchanged', () => {
    const fixture = setup([card('absent_days', 'critical')]);
    expect((fixture.nativeElement.querySelector('[data-testid="kpi-card"]') as HTMLElement).className).toContain('bg-red-50');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include src/app/modules/people/ui/overview-kpi-strip --watch=false`
Expected: FAIL — `cardSelected` undefined.

- [ ] **Step 3: Implement**

Add `output` to the Angular import and `readonly cardSelected = output<string>();` to the class, plus:

```ts
  select(card: KpiCard): void {
    if (card.tone !== 'baseline') this.cardSelected.emit(card.key);
  }
```

On the card `<div data-testid="kpi-card" ...>` add (keep `[class]="toneClass[card.tone]"` exactly as is):

```html
          [attr.role]="card.tone === 'baseline' ? null : 'button'"
          [attr.tabindex]="card.tone === 'baseline' ? null : 0"
          [class.cursor-pointer]="card.tone !== 'baseline'"
          (click)="select(card)"
          (keydown.enter)="select(card)"
```

- [ ] **Step 4: Run to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.ts src/app/modules/people/ui/overview-kpi-strip/overview-kpi-strip.component.spec.ts
git commit -m "feat(people): coloured KPI cards select their Needs Attention signal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Overview tab wiring, Discipline removal, full verification

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/overview-tab.component.ts`
- Modify: `src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts`, `overview-tab.layout.spec.ts`, `overview-tab.plan4.spec.ts` (provider + Discipline references)
- Delete: `src/app/modules/people/ui/overview-discipline-widget/` (component + spec)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing tests** (add to `overview-tab.component.spec.ts`, reusing its existing `setup`; add `getOverviewSignalItems: vi.fn(() => of({ key: 'over_break', total: 0, timezone: null, items: [] }))` to its `PeopleApiService` mock, and ensure its signals mock returns an `over_break` warning signal for these tests)

```ts
  it('opens the matching Needs Attention row when a coloured KPI card is clicked', async () => {
    const { fixture } = await setupWithSignals([{ key: 'over_break', rank: 3, severity: 'warning', category: 'attendance',
      value: 35, unit: 'minutes', denominator: 2, label: '35 min over break allowance', detail: 'Exceeded on 2 days' }]);
    const scroll = vi.fn();
    const attention = fixture.nativeElement.querySelector('app-overview-needs-attention') as HTMLElement;
    attention.scrollIntoView = scroll;

    (fixture.nativeElement.querySelector('[data-testid="kpi-card"][role="button"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="over_break"]')!.getAttribute('aria-expanded')).toBe('true');
    expect(scroll).toHaveBeenCalled();
  });

  it('closes the open row when the month changes', async () => {
    const { fixture } = await setupWithSignals([{ key: 'over_break', rank: 3, severity: 'warning', category: 'attendance',
      value: 35, unit: 'minutes', denominator: 2, label: '35 min over break allowance', detail: 'Exceeded on 2 days' }]);
    (fixture.nativeElement.querySelector('[data-key="over_break"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // EmployeePeriodStore is provided by the tab component itself, not the TestBed root.
    fixture.debugElement.injector.get(EmployeePeriodStore).setMonth('2026-08');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="over_break"]')?.getAttribute('aria-expanded') ?? 'false').toBe('false');
  });

  it('no longer renders the Discipline widget but keeps the approvals widget', async () => {
    const { fixture } = await setupWithSignals([]);
    expect(fixture.nativeElement.querySelector('app-overview-discipline-widget')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-overview-approvals-widget')).toBeTruthy();
  });
```

`setupWithSignals(signals)` is the file's existing setup with its `getOverviewSignals` mock returning `of({ from, to, signals })`; if the existing helper hard-codes signals, add this parameter to it rather than writing a second harness.

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --include src/app/modules/people/feature/employee-detail --watch=false`
Expected: the 3 new tests FAIL.

- [ ] **Step 3: Implement**

In `overview-tab.component.ts`:

1. `providers: [EmployeePeriodStore, SignalDrilldownStore]`.
2. Imports: remove `OverviewDisciplineWidgetComponent` (import line and `imports` array entry); add `SignalItemDetailComponent`, `SignalDrilldownStore`, and `ElementRef, untracked` from `@angular/core`.
3. Template:
   - Delete `<app-overview-discipline-widget [employeeId]="employeeId()" />` from the hidden `sr-only` block. Keep `<app-overview-approvals-widget #approvalsWidget ...>` and `<app-overview-delivery-widget ...>` there.
   - On `<app-overview-kpi-strip ...>` add `(cardSelected)="openSignal($event)"`.
   - Just before the closing of the template, add `<app-signal-item-detail [employeeId]="employeeId()" (changed)="signalsLoader.reload()" />`.
4. Class:

```ts
  protected readonly drilldown = inject(SignalDrilldownStore);
  private readonly needsAttention = viewChild(OverviewNeedsAttentionComponent, { read: ElementRef });
```

   and in the constructor, after the existing `effect`:

```ts
    effect(() => this.drilldown.setEmployee(this.employeeId()));
    // Items are cached per period; a new month or comparison closes the row and drops the cache.
    effect(() => {
      this.store.from();
      this.store.to();
      this.store.compareMonth();
      untracked(() => this.drilldown.reset());
    });
```

   plus:

```ts
  protected openSignal(key: string): void {
    this.drilldown.open(key);
    (this.needsAttention()?.nativeElement as HTMLElement | undefined)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
```

   Confirm `signalsLoader.reload` exists on `createWidgetLoader`'s return (it is used as `loader.reload()` in the widgets); confirm `compareMonth` is exposed on `EmployeePeriodStore` (state field, line ~15).

5. Delete the Discipline widget:

```bash
git rm -r src/app/modules/people/ui/overview-discipline-widget
grep -rn "overview-discipline-widget\|OverviewDisciplineWidgetComponent" src/app
```
   Expected: no matches left (fix any spec that still imports it — e.g. `overview-tab.layout.spec.ts` / `overview-tab.plan4.spec.ts` assertions that it renders; change them to assert it does not).

6. In each overview-tab spec file whose `PeopleApiService` mock lacks `getOverviewSignalItems`, add `getOverviewSignalItems: vi.fn(() => of({ key: '', total: 0, timezone: null, items: [] }))`, and provide `{ provide: ProjectDetailStore, useValue: { loadProject: vi.fn(), loadMyMilestones: vi.fn(), projectError: vi.fn(() => null) } }` if the tab's new child pulls it in during those specs.

- [ ] **Step 4: Run the people + attendance suites and the build**

```bash
npx ng test --include src/app/modules/people --include src/app/modules/attendance --watch=false
npx ng build
```
Expected: all tests PASS; build succeeds. Paste the final `Test Files … / Tests …` lines into the task report verbatim.

- [ ] **Step 5: Live check in the browser** (needs the backend plan merged and running)

On a dev tenant (`*.onexso.com` — the sandboxed Browser pane blocks scripts there, so use Claude in Chrome or ask the user), open an employee with violations this month → Overview:
1. Click a Needs Attention row → items appear under it; click another → the first closes.
2. Click a day → the attendance day drawer opens for that date in the employee's timezone; close returns to the open row.
3. Overdue tasks → grouped by project; click a task → the task modal opens and can save.
4. Pending approval → expands inline; "Review in approvals →" goes to the right inbox.
5. Click a coloured KPI card → page scrolls to Needs Attention with that row open. KPI colours unchanged.
6. Change the month → the open row closes.
Record what was checked and any failure in the task report.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/overview-tab.component.ts src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts src/app/modules/people/feature/employee-detail/overview-tab.layout.spec.ts src/app/modules/people/feature/employee-detail/overview-tab.plan4.spec.ts
git commit -m "feat(people): wire Needs Attention drill-down into the Overview tab; drop hidden Discipline widget

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(The `git rm` in Step 3 already staged the Discipline deletion; it lands in this commit.)
