# Employee Overview — Attendance, Discipline & Time-Off (Plan 2, frontend half)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an **Overview** tab (first tab, default) to the employee detail page with a month picker and three independently loading widgets — Attendance, Attendance Discipline, Time Off — each fed by its own endpoint.

**Architecture:** A scoped `EmployeePeriodStore` (`@ngrx/signals`, provided by the Overview tab) holds the selected month. A tiny `createWidgetLoader` helper turns "an Observable that depends on signals" into `data`/`state` signals with cancel-on-change, stale-response protection, retry and 403 detection, feeding the Plan 1 `WidgetCardComponent`. Each widget is a small standalone component that owns its own fetch. Period-aware widgets (Attendance, Discipline) refetch when the month changes; Time Off is year-based and does not.

**Tech Stack:** Angular 21 (standalone, OnPush, signal inputs), `@ngrx/signals` v21, RxJS, Tailwind + CSS variables, Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/2026-09-30-employee-detail-redesign-design.md`. Backend half: `HRMS-Backend-v1/docs/superpowers/plans/2026-09-30-employee-overview-attendance-timeoff-backend.md` (needed running only for Task 7's live check; Tasks 1-6 use mocks).

**Prerequisite:** Plan 1's frontend is fully committed — in particular Plan 1 Task 7 (the `EmployeeDetailComponent` restructure with `DetailTab = 'employment' | 'personal'`). Task 6 below edits that component and spec and its anchors are Plan 1 Task 7's final text; if an `Edit` anchor does not match, re-read the file and adapt the edit, do not force it.

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Run `git branch --show-current` and `git status --short` right before every commit (other sessions share this tree); stage only the files listed in the task.
- **No git worktrees.**
- Test runner is **Vitest**: `vi.fn()` / `vi.spyOn()`; `describe/it/expect/vi` are global in component specs (existing specs import nothing); pure-util specs import from `'vitest'`. Single-file run: `npx ng test --watch=false --include "<spec path>"`.
- Angular esbuild resolves lazy `loadComponent()` imports eagerly (no new routes here).
- No `rxResource`/`httpResource` in this codebase: widgets use `createWidgetLoader` (Observable → signals).
- Months are `YYYY-MM` strings; ranges sent to the API are inclusive `YYYY-MM-DD` (`from` = first day, `to` = last day). Never build dates with `new Date('YYYY-MM-DD')` for display (UTC-shift trap): parse the string parts.
- Leave balances are shown in **hours** (the backend has no hours-per-day constant); do not convert to days.
- Location violations render only when `locationTrackingEnabled` is true; otherwise "Not monitored". They are alert events, label them "alerts".
- Widgets never render their own frame: always `app-widget-card` (Plan 1, `src/app/shared/ui/widget-card/widget-card.component.ts`, inputs `title`, `state`, `errorMessage`, `emptyMessage`, output `retry`).
- Colors use existing CSS variables (`--color-border`, `--color-surface`, `--color-surface-secondary`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-danger-text`); the day-strip status colors are fixed hexes declared once in the attendance widget.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Overview models + API methods

**Files:**
- Create: `src/app/modules/people/models/employee-overview.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Modify (test): `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces (from `employee-overview.model.ts`): `AttendanceDayStatus`, `EmployeeAttendanceDay`, `EmployeeAttendanceOverviewResponse`, `EmployeeAttendanceDisciplineResponse`, `EmployeeTimeOffBalance`, `EmployeeUpcomingLeave`, `EmployeeTimeOffResponse`.
- Produces on `PeopleApiService`:
  - `getOverviewAttendance(employeeId: string, from: string, to: string): Observable<EmployeeAttendanceOverviewResponse>`
  - `getOverviewAttendanceDiscipline(employeeId: string, from: string, to: string): Observable<EmployeeAttendanceDisciplineResponse>`
  - `getOverviewTimeOff(employeeId: string, year?: number): Observable<EmployeeTimeOffResponse>`

- [ ] **Step 1: Write the failing tests**

Add inside the top-level `describe('PeopleApiService', …)` in `people-api.service.spec.ts`:

```ts
  it('getOverviewAttendance GETs /employees/{id}/overview/attendance with from and to', () => {
    let received: unknown;
    service.getOverviewAttendance('emp-1', '2026-09-01', '2026-09-30').subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/attendance`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({ days: [] });
    expect(received).toEqual({ days: [] });
  });

  it('getOverviewAttendanceDiscipline GETs /employees/{id}/overview/attendance-discipline with from and to', () => {
    service.getOverviewAttendanceDiscipline('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/attendance-discipline`
    );
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({});
  });

  it('getOverviewTimeOff GETs /employees/{id}/overview/time-off and sends year only when given', () => {
    service.getOverviewTimeOff('emp-1').subscribe();
    const noYear = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/time-off`);
    expect(noYear.request.params.has('year')).toBe(false);
    noYear.flush({});

    service.getOverviewTimeOff('emp-1', 2025).subscribe();
    const withYear = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/time-off`);
    expect(withYear.request.params.get('year')).toBe('2025');
    withYear.flush({});
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: FAIL — the three methods do not exist.

- [ ] **Step 3: Add the models**

`employee-overview.model.ts`:

```ts
export type AttendanceDayStatus =
  | 'present'
  | 'late'
  | 'missing_clock_out'
  | 'leave'
  | 'off'
  | 'absent'
  | 'none';

export interface EmployeeAttendanceDay {
  readonly date: string;
  readonly status: AttendanceDayStatus;
}

/** Mirrors HRMS-Backend-v1 EmployeeAttendanceOverviewResponse. */
export interface EmployeeAttendanceOverviewResponse {
  readonly from: string;
  readonly to: string;
  readonly workingDays: number;
  readonly present: number;
  readonly late: number;
  readonly missingClockOuts: number;
  readonly leaveDays: number;
  readonly days: readonly EmployeeAttendanceDay[];
}

/** Mirrors EmployeeAttendanceDisciplineResponse. locationViolations is null when tracking is off. */
export interface EmployeeAttendanceDisciplineResponse {
  readonly from: string;
  readonly to: string;
  readonly lateClockIns: number;
  readonly earlyClockOuts: number;
  readonly missingClockOuts: number;
  readonly overBreakDays: number;
  readonly overBreakMinutes: number;
  readonly locationTrackingEnabled: boolean;
  readonly locationViolations: number | null;
}

export interface EmployeeTimeOffBalance {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeCode: string;
  readonly entitledHours: number;
  readonly usedHours: number;
  readonly pendingHours: number;
  readonly remainingHours: number;
  readonly isNegative: boolean;
}

export interface EmployeeUpcomingLeave {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly totalHours: number;
}

/** Mirrors EmployeeTimeOffResponse. Balances are in hours. */
export interface EmployeeTimeOffResponse {
  readonly year: number;
  readonly balances: readonly EmployeeTimeOffBalance[];
  readonly nextLeave: EmployeeUpcomingLeave | null;
}
```

- [ ] **Step 4: Add the API methods**

In `people-api.service.ts` add to the imports:

```ts
import {
  EmployeeAttendanceDisciplineResponse,
  EmployeeAttendanceOverviewResponse,
  EmployeeTimeOffResponse
} from '../models/employee-overview.model';
```

and next to `getWorkGraph`:

```ts
  getOverviewAttendance(employeeId: string, from: string, to: string): Observable<EmployeeAttendanceOverviewResponse> {
    return this.http.get<EmployeeAttendanceOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/attendance`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getOverviewAttendanceDiscipline(
    employeeId: string,
    from: string,
    to: string
  ): Observable<EmployeeAttendanceDisciplineResponse> {
    return this.http.get<EmployeeAttendanceDisciplineResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/attendance-discipline`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getOverviewTimeOff(employeeId: string, year?: number): Observable<EmployeeTimeOffResponse> {
    let params = new HttpParams();
    if (year !== undefined) {
      params = params.set('year', String(year));
    }
    return this.http.get<EmployeeTimeOffResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/time-off`,
      { params }
    );
  }
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: PASS (whole file).

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/models/employee-overview.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat(people): add employee overview models and API methods

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `createWidgetLoader`

**Files:**
- Create: `src/app/shared/ui/widget-card/widget-loader.ts`
- Test: `src/app/shared/ui/widget-card/widget-loader.spec.ts`

**Interfaces:**
- Consumes: `WidgetState` from `./widget-card.component` (Plan 1).
- Produces: `createWidgetLoader<T>(source: () => Observable<T> | null, options?: { isEmpty?: (value: T) => boolean }): WidgetLoader<T>` where `WidgetLoader<T> = { data: Signal<T | null>; state: Signal<WidgetState>; reload(): void }`. **Must be called in an injection context** (a field initializer). `source` may read signals; when any change it cancels the in-flight request and refetches. Returning `null` from `source` means "not ready" (stays `loading`, no request). HTTP 403 ⇒ `forbidden`, any other error ⇒ `error`. Used by Tasks 4-5.

- [ ] **Step 1: Write the failing test**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { createWidgetLoader } from './widget-loader';

@Component({ standalone: true, template: '' })
class HostComponent {
  readonly id = signal('a');
  source: (id: string) => Observable<string> | null = (id) => of(`data-${id}`);
  readonly loader = createWidgetLoader<string>(() => this.source(this.id()), { isEmpty: (v) => v === '' });
}

describe('createWidgetLoader', () => {
  function setup(source?: HostComponent['source']) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    if (source) fixture.componentInstance.source = source;
    return { fixture, host: fixture.componentInstance };
  }

  it('starts loading, then exposes ready data', () => {
    const subject = new Subject<string>();
    const { fixture, host } = setup(() => subject.asObservable());
    fixture.detectChanges();

    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();

    subject.next('hello');
    expect(host.loader.state()).toBe('ready');
    expect(host.loader.data()).toBe('hello');
  });

  it('reports empty when isEmpty says so', () => {
    const { fixture, host } = setup(() => of(''));
    fixture.detectChanges();

    expect(host.loader.state()).toBe('empty');
  });

  it('maps a 403 to forbidden and any other error to error, clearing data', () => {
    const forbidden = setup(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    forbidden.fixture.detectChanges();
    expect(forbidden.host.loader.state()).toBe('forbidden');
    expect(forbidden.host.loader.data()).toBeNull();

    TestBed.resetTestingModule();
    const failed = setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    failed.fixture.detectChanges();
    expect(failed.host.loader.state()).toBe('error');
  });

  it('refetches when a tracked signal changes and ignores the stale in-flight response', () => {
    const first = new Subject<string>();
    const second = new Subject<string>();
    const source = vi.fn((id: string) => (id === 'a' ? first : second).asObservable());
    const { fixture, host } = setup(source);
    fixture.detectChanges();

    host.id.set('b');
    fixture.detectChanges();
    expect(source).toHaveBeenCalledTimes(2);

    first.next('stale');
    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();

    second.next('fresh');
    expect(host.loader.state()).toBe('ready');
    expect(host.loader.data()).toBe('fresh');
  });

  it('reload() issues the request again', () => {
    const source = vi.fn((id: string) => of(`data-${id}`));
    const { fixture, host } = setup(source);
    fixture.detectChanges();

    host.loader.reload();
    fixture.detectChanges();

    expect(source).toHaveBeenCalledTimes(2);
    expect(host.loader.state()).toBe('ready');
  });

  it('stays loading and makes no request while the source returns null', () => {
    const { fixture, host } = setup(() => null);
    fixture.detectChanges();

    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();
  });

  it('unsubscribes from an in-flight request when the host is destroyed', () => {
    const subject = new Subject<string>();
    const { fixture } = setup(() => subject.asObservable());
    fixture.detectChanges();
    expect(subject.observed).toBe(true);

    fixture.destroy();

    expect(subject.observed).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/shared/ui/widget-card/widget-loader.spec.ts"`
Expected: FAIL — cannot resolve `./widget-loader`.

- [ ] **Step 3: Write the helper**

`widget-loader.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { WidgetState } from './widget-card.component';

export interface WidgetLoader<T> {
  readonly data: Signal<T | null>;
  readonly state: Signal<WidgetState>;
  reload(): void;
}

export interface WidgetLoaderOptions<T> {
  /** When true for a successful response, the widget shows its empty state. */
  readonly isEmpty?: (value: T) => boolean;
}

/**
 * Observable -> signals for one dashboard widget. `source` is re-evaluated whenever a signal it
 * reads changes: the previous request is unsubscribed (so a slow stale response can never
 * overwrite a newer one) and a new one starts. Returning null means "not ready yet".
 * Call from an injection context (a field initializer).
 */
export function createWidgetLoader<T>(
  source: () => Observable<T> | null,
  options: WidgetLoaderOptions<T> = {}
): WidgetLoader<T> {
  const data = signal<T | null>(null);
  const state = signal<WidgetState>('loading');
  const reloadTick = signal(0);
  let subscription: Subscription | undefined;

  inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());

  effect(() => {
    const request = source();
    reloadTick();

    untracked(() => {
      subscription?.unsubscribe();
      subscription = undefined;
      data.set(null);
      state.set('loading');
      if (request === null) return;

      subscription = request.subscribe({
        next: (value) => {
          data.set(value);
          state.set(options.isEmpty?.(value) ? 'empty' : 'ready');
        },
        error: (err: unknown) => {
          data.set(null);
          state.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
    });
  });

  return { data, state, reload: () => reloadTick.update((n) => n + 1) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/shared/ui/widget-card/widget-loader.spec.ts"`
Expected: 8 passed (7 `it` blocks; the error/forbidden `it` asserts two cases). If `subject.observed` is not available in the installed RxJS, replace the last two assertions with a `subscribe`-count check via `new Observable(sub => { subscribed++; return () => { unsubscribed++; }; })` — assert `unsubscribed === 1` after `fixture.destroy()`.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/shared/ui/widget-card/widget-loader.ts src/app/shared/ui/widget-card/widget-loader.spec.ts
git commit -m "feat(ui): add createWidgetLoader for per-widget data loading

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Period utils, `EmployeePeriodStore`, period picker

**Files:**
- Create: `src/app/modules/people/utils/employee-overview.utils.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/state/employee-period.store.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/employee-period-picker/employee-period-picker.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces in `employee-overview.utils.ts`:
  - `currentMonthKey(now?: Date): string` — `'YYYY-MM'` (local date parts)
  - `monthBounds(month: string): { from: string; to: string }` — inclusive ISO dates
  - `monthLabel(month: string): string` — e.g. `'Sep 2026'` (own month table, not `Intl`, to avoid `Sept`)
  - `recentMonths(now?: Date, count?: number): readonly { value: string; label: string }[]` — newest first, default 12
  - `formatHours(value: number): string` — `12 h`, `7.5 h`, `0.25 h`
  - `formatLeaveRange(start: string, end: string): string` — `Sep 23`, `Sep 23 – 25`, `Sep 30 – Oct 2`
  - `attendanceDayLabel(status: AttendanceDayStatus): string`
- Produces `EmployeePeriodStore` (signalStore, **no** `providedIn`; the Overview tab provides it): state `{ month: string }`, computed `from`, `to`, `label`, method `setMonth(month: string): void`.
- Produces `<app-employee-period-picker>`: reads/writes the store; exposes `options` and `onChange(month: string)`.

- [ ] **Step 1: Write the failing util tests**

`employee-overview.utils.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  attendanceDayLabel,
  currentMonthKey,
  formatHours,
  formatLeaveRange,
  monthBounds,
  monthLabel,
  recentMonths
} from './employee-overview.utils';

describe('employee-overview.utils', () => {
  it('currentMonthKey zero-pads the month', () => {
    expect(currentMonthKey(new Date(2026, 8, 30))).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });

  it('monthBounds returns the first and real last day', () => {
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('monthLabel uses short English month names', () => {
    expect(monthLabel('2026-09')).toBe('Sep 2026');
    expect(monthLabel('2026-01')).toBe('Jan 2026');
  });

  it('recentMonths lists the current month first and crosses year boundaries', () => {
    const months = recentMonths(new Date(2026, 1, 10), 4);

    expect(months.map((m) => m.value)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(months[0].label).toBe('Feb 2026');
  });

  it('recentMonths defaults to 12 entries', () => {
    expect(recentMonths(new Date(2026, 8, 30))).toHaveLength(12);
  });

  it('formatHours trims trailing zeros', () => {
    expect(formatHours(12)).toBe('12 h');
    expect(formatHours(7.5)).toBe('7.5 h');
    expect(formatHours(0.25)).toBe('0.25 h');
    expect(formatHours(-3)).toBe('-3 h');
  });

  it('formatLeaveRange collapses same-day and same-month ranges', () => {
    expect(formatLeaveRange('2026-09-23', '2026-09-23')).toBe('Sep 23');
    expect(formatLeaveRange('2026-09-23', '2026-09-25')).toBe('Sep 23 – 25');
    expect(formatLeaveRange('2026-09-30', '2026-10-02')).toBe('Sep 30 – Oct 2');
  });

  it('attendanceDayLabel covers every status', () => {
    expect(attendanceDayLabel('present')).toBe('Present');
    expect(attendanceDayLabel('late')).toBe('Late');
    expect(attendanceDayLabel('missing_clock_out')).toBe('Missing clock-out');
    expect(attendanceDayLabel('leave')).toBe('On leave');
    expect(attendanceDayLabel('off')).toBe('Day off');
    expect(attendanceDayLabel('absent')).toBe('Absent');
    expect(attendanceDayLabel('none')).toBe('Upcoming');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-overview.utils.spec.ts"`
Expected: FAIL — cannot resolve `./employee-overview.utils`.

- [ ] **Step 3: Write the utils**

`employee-overview.utils.ts`:

```ts
import { AttendanceDayStatus } from '../models/employee-overview.model';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM' for the given local date. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** Inclusive ISO date bounds for a 'YYYY-MM' month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad2(lastDay)}` };
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/** Newest first, starting at the month containing `now`. */
export function recentMonths(now: Date = new Date(), count = 12): readonly { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = currentMonthKey(date);
    months.push({ value, label: monthLabel(value) });
  }
  return months;
}

export function formatHours(value: number): string {
  return `${Math.round(value * 100) / 100} h`;
}

function shortDate(iso: string): { month: string; day: number } {
  const [, month, day] = iso.split('-').map(Number);
  return { month: MONTH_NAMES[month - 1], day };
}

/** 'Sep 23', 'Sep 23 – 25' or 'Sep 30 – Oct 2' from ISO dates (string parts, no Date parsing). */
export function formatLeaveRange(start: string, end: string): string {
  const s = shortDate(start);
  const e = shortDate(end);
  if (start === end) return `${s.month} ${s.day}`;
  if (s.month === e.month) return `${s.month} ${s.day} – ${e.day}`;
  return `${s.month} ${s.day} – ${e.month} ${e.day}`;
}

const DAY_LABELS: Record<AttendanceDayStatus, string> = {
  present: 'Present',
  late: 'Late',
  missing_clock_out: 'Missing clock-out',
  leave: 'On leave',
  off: 'Day off',
  absent: 'Absent',
  none: 'Upcoming'
};

export function attendanceDayLabel(status: AttendanceDayStatus): string {
  return DAY_LABELS[status];
}
```

- [ ] **Step 4: Run the util tests**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-overview.utils.spec.ts"`
Expected: 8 passed.

- [ ] **Step 5: Write the failing store and picker tests**

`employee-period.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    return TestBed.inject(EmployeePeriodStore);
  }

  it('starts on the current month', () => {
    const store = setup();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    expect(store.month()).toBe(expected);
  });

  it('derives inclusive from/to and a label from the month', () => {
    const store = setup();

    store.setMonth('2026-02');

    expect(store.from()).toBe('2026-02-01');
    expect(store.to()).toBe('2026-02-28');
    expect(store.label()).toBe('Feb 2026');
  });

  it('updates derived values when the month changes again', () => {
    const store = setup();
    store.setMonth('2026-02');

    store.setMonth('2026-12');

    expect(store.from()).toBe('2026-12-01');
    expect(store.to()).toBe('2026-12-31');
  });
});
```

`employee-period-picker.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodPickerComponent } from './employee-period-picker.component';

describe('EmployeePeriodPickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeePeriodPickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    const fixture = TestBed.createComponent(EmployeePeriodPickerComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('offers the last 12 months, newest first, starting at the current month', () => {
    const { fixture, store } = setup();

    expect(fixture.componentInstance.options).toHaveLength(12);
    expect(fixture.componentInstance.options[0].value).toBe(store.month());
  });

  it('renders the shared select control', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the chosen month to the store', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('2026-05');

    expect(store.month()).toBe('2026-05');
    expect(store.from()).toBe('2026-05-01');
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/state/employee-period.store.spec.ts" --include "src/app/modules/people/ui/employee-period-picker/*.spec.ts"`
Expected: FAIL — store and picker do not exist.

- [ ] **Step 7: Write the store and the picker**

`state/employee-period.store.ts`:

```ts
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { currentMonthKey, monthBounds, monthLabel } from '../utils/employee-overview.utils';

export interface EmployeePeriodState {
  /** 'YYYY-MM' */
  readonly month: string;
}

/**
 * The month every period-aware Overview widget reads. Deliberately not providedIn: 'root' - the
 * Overview tab provides its own instance so the selection resets per employee page.
 */
export const EmployeePeriodStore = signalStore(
  withState<EmployeePeriodState>({ month: currentMonthKey() }),
  withComputed(({ month }) => ({
    from: computed(() => monthBounds(month()).from),
    to: computed(() => monthBounds(month()).to),
    label: computed(() => monthLabel(month()))
  })),
  withMethods((store) => ({
    setMonth(month: string): void {
      patchState(store, { month });
    }
  }))
);
```

`ui/employee-period-picker/employee-period-picker.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { recentMonths } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-employee-period-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Select month"
      [options]="options"
      [value]="store.month()"
      (valueChange)="onChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePeriodPickerComponent {
  protected readonly store = inject(EmployeePeriodStore);

  readonly options: readonly SelectOption[] = recentMonths();

  onChange(month: string): void {
    this.store.setMonth(month);
  }
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-overview.utils.spec.ts" --include "src/app/modules/people/state/employee-period.store.spec.ts" --include "src/app/modules/people/ui/employee-period-picker/*.spec.ts"`
Expected: 8 + 3 + 3 passed.

- [ ] **Step 9: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/utils/employee-overview.utils.ts src/app/modules/people/utils/employee-overview.utils.spec.ts src/app/modules/people/state/employee-period.store.ts src/app/modules/people/state/employee-period.store.spec.ts src/app/modules/people/ui/employee-period-picker
git commit -m "feat(people): add overview period store, month utils and picker

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Attendance and Discipline widgets

**Files:**
- Create: `src/app/modules/people/ui/overview-attendance-widget/overview-attendance-widget.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/overview-discipline-widget/overview-discipline-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `createWidgetLoader` (Task 2), `WidgetCardComponent` (Plan 1), `EmployeePeriodStore` (Task 3), `PeopleApiService.getOverviewAttendance/getOverviewAttendanceDiscipline` (Task 1), `attendanceDayLabel` (Task 3).
- Produces: `<app-overview-attendance-widget [employeeId]>` and `<app-overview-discipline-widget [employeeId]>` — both required `employeeId: string`; both refetch when `EmployeePeriodStore.month` changes (the store must be provided by an ancestor — Task 6).

- [ ] **Step 1: Write the failing attendance widget test**

`overview-attendance-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewAttendanceWidgetComponent } from './overview-attendance-widget.component';

describe('OverviewAttendanceWidgetComponent', () => {
  const response: EmployeeAttendanceOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    workingDays: 22,
    present: 17,
    late: 2,
    missingClockOuts: 1,
    leaveDays: 3,
    days: [
      { date: '2026-09-01', status: 'present' },
      { date: '2026-09-02', status: 'late' },
      { date: '2026-09-03', status: 'missing_clock_out' },
      { date: '2026-09-04', status: 'leave' },
      { date: '2026-09-05', status: 'off' }
    ]
  };

  function setup(getOverviewAttendance: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewAttendanceWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendance } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewAttendanceWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the selected month for the employee', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    setup(getOverviewAttendance);

    expect(getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the present, late, missing clock-out and leave counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const stats = el.querySelector('[data-testid="attendance-stats"]')!.textContent!;

    expect(stats).toContain('17');
    expect(stats).toContain('Present');
    expect(stats).toContain('Late');
    expect(stats).toContain('Missing clock-out');
    expect(stats).toContain('Leave');
    expect(el.querySelector('[data-testid="stat-missing"]')!.textContent).toContain('1');
  });

  it('draws one strip bar per day with its status class and an accessible title', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const bars = el.querySelectorAll('[data-testid="day-bar"]');

    expect(bars).toHaveLength(5);
    expect(bars[0].classList.contains('day--present')).toBe(true);
    expect(bars[1].classList.contains('day--late')).toBe(true);
    expect(bars[2].classList.contains('day--missing_clock_out')).toBe(true);
    expect(bars[3].classList.contains('day--leave')).toBe(true);
    expect(bars[4].classList.contains('day--off')).toBe(true);
    expect(bars[1].getAttribute('title')).toBe('2026-09-02 · Late');
  });

  it('refetches when the month changes', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(getOverviewAttendance);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(getOverviewAttendance).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when the period has no attendance days', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, days: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403 and an error state with retry on other failures', () => {
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();

    TestBed.resetTestingModule();
    const getOverviewAttendance = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(response));
    const failed = setup(getOverviewAttendance);
    (failed.el.querySelector('app-error-state button') as HTMLButtonElement).click();
    failed.fixture.detectChanges();

    expect(getOverviewAttendance).toHaveBeenCalledTimes(2);
    expect(failed.el.querySelector('[data-testid="attendance-stats"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-attendance-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the attendance widget**

`overview-attendance-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDay } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { attendanceDayLabel } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-overview-attendance-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Attendance"
      [state]="loader.state()"
      errorMessage="Could not load attendance."
      emptyMessage="No attendance records for this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="attendance-stats">
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="stat-present">{{ d.present }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Present</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.late > 0" [class.text-[var(--color-text-primary)]]="d.late === 0" data-testid="stat-late">{{ d.late }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Late</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.missingClockOuts > 0" [class.text-[var(--color-text-primary)]]="d.missingClockOuts === 0" data-testid="stat-missing">{{ d.missingClockOuts }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Missing clock-out</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="stat-leave">{{ d.leaveDays }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Leave</dt>
          </div>
        </dl>

        <div class="mt-5 flex h-12 items-end gap-[3px]" role="img" [attr.aria-label]="stripLabel(d.days)" data-testid="attendance-strip">
          @for (day of d.days; track day.date) {
            <span
              data-testid="day-bar"
              class="day flex-1"
              [class]="'day--' + day.status"
              [attr.title]="day.date + ' · ' + label(day.status)"
            ></span>
          }
        </div>
        <p class="mt-2 text-xs text-[var(--color-text-secondary)]">
          {{ d.present }} of {{ d.workingDays }} working days attended
        </p>
      }
    </app-widget-card>
  `,
  styles: [`
    .day { min-width: 3px; border-radius: 2px; height: 100%; }
    .day--present { background: #16a34a; }
    .day--late { background: #f59e0b; }
    .day--missing_clock_out { background: #dc2626; }
    .day--leave { background: #3b82f6; }
    .day--absent { background: #f43f5e; }
    .day--off { background: var(--color-border); height: 30%; }
    .day--none { background: var(--color-surface-secondary); height: 30%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewAttendanceWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewAttendance(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.days.length === 0 }
  );

  label = attendanceDayLabel;

  stripLabel(days: readonly EmployeeAttendanceDay[]): string {
    const count = (status: EmployeeAttendanceDay['status']) => days.filter((d) => d.status === status).length;
    return `Daily attendance: ${count('present')} present, ${count('late')} late, ${count('missing_clock_out')} missing clock-out, ${count('leave')} on leave, ${count('absent')} absent`;
  }
}
```

- [ ] **Step 4: Run to verify the attendance tests pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-attendance-widget/*.spec.ts"`
Expected: 6 passed.

- [ ] **Step 5: Write the failing discipline widget test**

`overview-discipline-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDisciplineWidgetComponent } from './overview-discipline-widget.component';

describe('OverviewDisciplineWidgetComponent', () => {
  const response: EmployeeAttendanceDisciplineResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    lateClockIns: 2,
    earlyClockOuts: 1,
    missingClockOuts: 1,
    overBreakDays: 3,
    overBreakMinutes: 45,
    locationTrackingEnabled: true,
    locationViolations: 4
  };

  function setup(getOverviewAttendanceDiscipline: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewDisciplineWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendanceDiscipline } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDisciplineWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const row = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="discipline-${key}"]`)!.textContent!;

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows each discipline measure', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(row(el, 'late')).toContain('2');
    expect(row(el, 'early')).toContain('1');
    expect(row(el, 'missing')).toContain('1');
    expect(row(el, 'over-break')).toContain('3 days');
    expect(row(el, 'over-break')).toContain('45 min');
    expect(row(el, 'location')).toContain('4 alerts');
  });

  it('says None for over-break when there are no over-break days', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, overBreakDays: 0, overBreakMinutes: 0 })));

    expect(row(el, 'over-break')).toContain('None');
  });

  it('uses the singular for one over-break day and one alert', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, overBreakDays: 1, overBreakMinutes: 10, locationViolations: 1 })));

    expect(row(el, 'over-break')).toContain('1 day');
    expect(row(el, 'over-break')).not.toContain('1 days');
    expect(row(el, 'location')).toContain('1 alert');
    expect(row(el, 'location')).not.toContain('1 alerts');
  });

  it('shows Not monitored for location when tracking is off', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, locationTrackingEnabled: false, locationViolations: null })));

    expect(row(el, 'location')).toContain('Not monitored');
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-discipline-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 7: Write the discipline widget**

`overview-discipline-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-overview-discipline-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Attendance Discipline"
      [state]="loader.state()"
      errorMessage="Could not load attendance discipline."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Late clock-ins</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.lateClockIns > 0" data-testid="discipline-late">{{ d.lateClockIns }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Early clock-outs</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.earlyClockOuts > 0" data-testid="discipline-early">{{ d.earlyClockOuts }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Missing clock-outs</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.missingClockOuts > 0" data-testid="discipline-missing">{{ d.missingClockOuts }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Over break</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="d.overBreakDays > 0" data-testid="discipline-over-break">{{ overBreakText(d) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Outside work location</dt>
            <dd class="font-semibold" [class.text-[var(--color-danger-text)]]="(d.locationViolations ?? 0) > 0" data-testid="discipline-location">{{ locationText(d) }}</dd>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDisciplineWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() =>
    this.api.getOverviewAttendanceDiscipline(this.employeeId(), this.period.from(), this.period.to())
  );

  overBreakText(d: EmployeeAttendanceDisciplineResponse): string {
    if (d.overBreakDays === 0) return 'None';
    return `${d.overBreakDays} ${d.overBreakDays === 1 ? 'day' : 'days'} · ${d.overBreakMinutes} min`;
  }

  locationText(d: EmployeeAttendanceDisciplineResponse): string {
    if (!d.locationTrackingEnabled) return 'Not monitored';
    const count = d.locationViolations ?? 0;
    return `${count} ${count === 1 ? 'alert' : 'alerts'}`;
  }
}
```

- [ ] **Step 8: Run to verify both widgets' tests pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-attendance-widget/*.spec.ts" --include "src/app/modules/people/ui/overview-discipline-widget/*.spec.ts"`
Expected: 6 + 7 passed.

- [ ] **Step 9: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-attendance-widget src/app/modules/people/ui/overview-discipline-widget
git commit -m "feat(people): add overview attendance and discipline widgets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Time Off widget

**Files:**
- Create: `src/app/modules/people/ui/overview-time-off-widget/overview-time-off-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `createWidgetLoader`, `WidgetCardComponent`, `PeopleApiService.getOverviewTimeOff` (Task 1), `formatHours`, `formatLeaveRange` (Task 3).
- Produces: `<app-overview-time-off-widget [employeeId]>` — required `employeeId: string`. **Year-based: does not read `EmployeePeriodStore`** and is not refetched when the month changes.

- [ ] **Step 1: Write the failing test**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeTimeOffResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewTimeOffWidgetComponent } from './overview-time-off-widget.component';

describe('OverviewTimeOffWidgetComponent', () => {
  const response: EmployeeTimeOffResponse = {
    year: 2026,
    balances: [
      { leaveTypeId: 't1', leaveTypeName: 'Annual leave', leaveTypeCode: 'AL', entitledHours: 96, usedHours: 0, pendingHours: 0, remainingHours: 96, isNegative: false },
      { leaveTypeId: 't2', leaveTypeName: 'Sick leave', leaveTypeCode: 'SL', entitledHours: 64, usedHours: 70.5, pendingHours: 0, remainingHours: -6.5, isNegative: true }
    ],
    nextLeave: { leaveTypeId: 't1', leaveTypeName: 'Annual leave', startDate: '2026-09-23', endDate: '2026-09-25', totalHours: 24 }
  };

  function setup(getOverviewTimeOff: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewTimeOffWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewTimeOff } }, EmployeePeriodStore]
    });
    const fixture = TestBed.createComponent(OverviewTimeOffWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store: TestBed.inject(EmployeePeriodStore), el: fixture.nativeElement as HTMLElement };
  }

  it('requests time off for the employee without a period', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1');
  });

  it('lists each balance as remaining hours out of entitled', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="balance-row"]');

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Annual leave');
    expect(rows[0].textContent).toContain('96 h');
    expect(rows[0].textContent).toContain('of 96 h');
  });

  it('marks an overdrawn balance', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="balance-row"]');

    expect(rows[1].textContent).toContain('6.5 h overdrawn');
    expect(rows[0].textContent).not.toContain('overdrawn');
  });

  it('shows the next approved leave with its dates, type and hours', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const next = el.querySelector('[data-testid="next-leave"]')!.textContent!;

    expect(next).toContain('Sep 23 – 25');
    expect(next).toContain('Annual leave');
    expect(next).toContain('24 h');
  });

  it('falls back to "Leave" when the type name is unknown, and hides the next-leave block when none', () => {
    const noName = setup(vi.fn().mockReturnValue(of({ ...response, nextLeave: { ...response.nextLeave!, leaveTypeName: null } })));
    expect(noName.el.querySelector('[data-testid="next-leave"]')!.textContent).toContain('Leave');

    TestBed.resetTestingModule();
    const none = setup(vi.fn().mockReturnValue(of({ ...response, nextLeave: null })));
    expect(none.el.querySelector('[data-testid="next-leave"]')).toBeFalsy();
  });

  it('shows the empty state when there are no balances and no upcoming leave', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('does not refetch when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-05');
    fixture.detectChanges();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-time-off-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the widget**

`overview-time-off-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatHours, formatLeaveRange } from '../../utils/employee-overview.utils';

/** Year-based: intentionally independent of the month period, so it never refetches on a month change. */
@Component({
  selector: 'app-overview-time-off-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Time Off"
      [state]="loader.state()"
      errorMessage="Could not load time off."
      emptyMessage="No leave entitlements for this year."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="space-y-3">
          @for (b of d.balances; track b.leaveTypeId) {
            <li class="flex items-baseline justify-between gap-3 text-sm" data-testid="balance-row">
              <span class="text-[var(--color-text-secondary)]">{{ b.leaveTypeName }}</span>
              <span class="text-right">
                <span class="font-semibold" [class.text-[var(--color-danger-text)]]="b.isNegative" [class.text-[var(--color-text-primary)]]="!b.isNegative">
                  @if (b.isNegative) { {{ hours(-b.remainingHours) }} overdrawn } @else { {{ hours(b.remainingHours) }} }
                </span>
                <span class="block text-xs text-[var(--color-text-secondary)]">of {{ hours(b.entitledHours) }}</span>
              </span>
            </li>
          }
        </ul>

        @if (d.nextLeave; as next) {
          <div class="mt-4 rounded-lg bg-[var(--color-surface-secondary)] p-3 text-sm" data-testid="next-leave">
            <p class="text-xs text-[var(--color-text-secondary)]">Next leave</p>
            <p class="font-semibold text-[var(--color-text-primary)]">{{ range(next.startDate, next.endDate) }}</p>
            <p class="text-xs text-[var(--color-text-secondary)]">{{ next.leaveTypeName || 'Leave' }} · {{ hours(next.totalHours) }}</p>
          </div>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTimeOffWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() => this.api.getOverviewTimeOff(this.employeeId()), {
    isEmpty: (v) => v.balances.length === 0 && v.nextLeave === null
  });

  hours = formatHours;
  range = formatLeaveRange;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-time-off-widget/*.spec.ts"`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-time-off-widget
git commit -m "feat(people): add overview time-off widget

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Overview tab + wire it into the detail page

**Files:**
- Create: `src/app/modules/people/feature/employee-detail/overview-tab.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Modify (test): `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: the three widgets (Tasks 4-5), `EmployeePeriodPickerComponent`, `EmployeePeriodStore` (Task 3).
- Produces: `<app-employee-overview-tab [employeeId]>` (required `employeeId: string`; **provides its own `EmployeePeriodStore`**); `EmployeeDetailComponent` gains `'overview'` as the first tab and default (`DetailTab = 'overview' | 'employment' | 'personal'`, `activeTab` default `'overview'`).

- [ ] **Step 1: Write the failing overview-tab test**

`overview-tab.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent', () => {
  function setup() {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })
      ),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })
      ),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeOverviewTabComponent],
      providers: [{ provide: PeopleApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the period picker and the three widgets', () => {
    const { el } = setup();

    expect(el.querySelector('app-employee-period-picker')).toBeTruthy();
    expect(el.querySelector('app-overview-attendance-widget')).toBeTruthy();
    expect(el.querySelector('app-overview-discipline-widget')).toBeTruthy();
    expect(el.querySelector('app-overview-time-off-widget')).toBeTruthy();
  });

  it('loads every widget for the employee', () => {
    const { api } = setup();

    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewTimeOff).toHaveBeenCalledWith('emp-1');
  });

  it('changing the month refetches the period-aware widgets but not time off', () => {
    const { fixture, api, el } = setup();
    const picker = el.querySelector('app-employee-period-picker') as HTMLElement;
    expect(picker).toBeTruthy();

    // The picker's onChange writes the tab-scoped store; drive it the same way the select does.
    const pickerInstance = fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance;
    pickerInstance.onChange('2026-05');
    fixture.detectChanges();

    expect(api.getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(2);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the overview tab**

`overview-tab.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { OverviewAttendanceWidgetComponent } from '../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewTimeOffWidgetComponent } from '../../ui/overview-time-off-widget/overview-time-off-widget.component';

/**
 * Overview tab. Owns the month selection (its own EmployeePeriodStore instance, so it resets per
 * employee page). Each widget loads independently; Time Off is year-based and ignores the month.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    OverviewAttendanceWidgetComponent,
    OverviewDisciplineWidgetComponent,
    OverviewTimeOffWidgetComponent
  ],
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Attendance for the selected month</p>
      <app-employee-period-picker />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-attendance-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-time-off-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4">
      <app-overview-discipline-widget [employeeId]="employeeId()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  readonly employeeId = input.required<string>();
}
```

- [ ] **Step 4: Run to verify the tab tests pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts"`
Expected: 3 passed.

- [ ] **Step 5: Wire the tab into `EmployeeDetailComponent`**

Re-read `employee-detail.component.ts` first (it must be Plan 1 Task 7's final version). Then apply these four edits.

(a) Imports — add next to the other tab imports:

```ts
import { EmployeeOverviewTabComponent } from './overview-tab.component';
```

and add `EmployeeOverviewTabComponent` to the `imports: [...]` array of `@Component` (after `EmployeePersonalTabComponent`).

(b) Replace `type DetailTab = 'employment' | 'personal';` with:

```ts
type DetailTab = 'overview' | 'employment' | 'personal';
```

(c) Replace the `tabs` array and the `activeTab` signal:

old:
```ts
  readonly tabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
    { id: 'employment', label: 'Employment' },
    { id: 'personal', label: 'Personal' }
  ];
  readonly activeTab = signal<DetailTab>('employment');
```
new:
```ts
  readonly tabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'employment', label: 'Employment' },
    { id: 'personal', label: 'Personal' }
  ];
  readonly activeTab = signal<DetailTab>('overview');
```

(d) Replace the tab-body block in the template:

old:
```html
      @if (activeTab() === 'employment') {
        <app-employee-employment-tab
```
new:
```html
      @if (activeTab() === 'overview') {
        <app-employee-overview-tab [employeeId]="employee.id" />
      } @else if (activeTab() === 'employment') {
        <app-employee-employment-tab
```
(leave everything after that line — the employment tab's inputs, the `} @else {` personal branch — exactly as it is).

- [ ] **Step 6: Update the detail spec (failing first)**

In `employee-detail.component.spec.ts`:

(a) In `setup(...)`'s `apiStub`, add next to `getWorkGraph`:

```ts
      getOverviewAttendance: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })
      ),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })
      ),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
```

(b) Replace the test `it('renders the Employment tab first and switches to the Personal tab', …)` (the block asserting `activeTab()` is `'employment'` first) with:

```ts
  it('renders the Overview tab first, then Employment and Personal on request', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('overview');
    expect(fixture.nativeElement.querySelector('app-employee-overview-tab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-employment-tab')).toBeFalsy();

    fixture.componentInstance.activeTab.set('employment');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-employee-employment-tab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-job-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-overview-tab')).toBeFalsy();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-employee-personal-tab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-emergency-contacts')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-employment-tab')).toBeFalsy();
  });

  it('lists the tabs in the order Overview, Employment, Personal', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('nav[aria-label="Employee Detail Sections"] button')
    ).map((b) => (b as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Overview', 'Employment', 'Personal']);
  });
```

If the `Edit` anchor for (b) does not match (Plan 1's executor may have worded the test slightly differently), locate the test that asserts the default tab and adapt it to the same assertions; the intent is fixed: default is `'overview'`.

- [ ] **Step 7: Run the detail spec, then the whole people module and a build**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts"`
Expected: all pass. If any *other* pre-existing test now fails because it expected Employment content on first render, fix it by adding `fixture.componentInstance.activeTab.set('employment'); fixture.detectChanges();` at its start — never by changing an assertion. (At the time of writing only the default-tab test depended on tab content.)

Run: `npx ng test --watch=false --include "src/app/modules/people/**/*.spec.ts"` — Expected: all pass.
Run: `npx ng build` — Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/feature/employee-detail/overview-tab.component.ts src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat(people): add Overview tab with attendance, discipline and time-off widgets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live verification (no code)

**Files:** none. Requires the Plan 2 backend endpoints running against a dev tenant.

- [ ] **Step 1:** Start the frontend via the launch config (`preview_start`) and sign in as a dev-tenant user with `employees:read`, `attendance:read`, `leave:read`. Open an employee with attendance history.
- [ ] **Step 2 — Overview:** the first tab is **Overview** and is selected by default. The month picker offers 12 months, current first. Attendance shows the four counts and a day strip whose bars are green/amber/red/blue/grey; hovering a bar shows `YYYY-MM-DD · Status`. Discipline shows all five rows; location says "Not monitored" for an employee without location verification. Time Off shows balances in hours and the next leave.
- [ ] **Step 3 — Independence:** with `read_network_requests`, change the month: **two** new requests (`overview/attendance`, `overview/attendance-discipline`) with the new `from`/`to`; **no** `overview/time-off` request. Switch to Employment and back: the Overview widgets reload once (the tab re-renders), and no request repeats while you stay on the tab.
- [ ] **Step 4 — States:** as a user without `attendance:read` viewing someone else → the Attendance and Discipline widgets show "You do not have access to this section." while Time Off still renders. Viewing your **own** record without `attendance:read` → the widgets render (self access). Kill the API briefly → widgets show the error state; restore and press Try again → they load.
- [ ] **Step 5:** `read_console_messages` shows no errors. Resize to mobile: no horizontal page scroll; widgets stack; the strip stays inside its card.
- [ ] **Step 6:** Report faithfully what was verified and what was not (e.g. if the dev tenant has no attendance rows the strip/counts path was only exercised by unit tests — say so). Take a screenshot of the populated Overview.

---

## Self-review (against the spec and the conversation)

- User's Overview additions: discipline now includes **over-break** and **location violations (only when tracked)** — Task 4 (discipline widget, the "Not monitored" rule).
- Widget independence and per-widget filters: `createWidgetLoader` (Task 2) + period store (Task 3); period-aware vs year-based split verified by tests in Tasks 4-6.
- Meaningful-only rule: Time Off in hours (no invented days), location shown as alerts, missing rows shown as empty state, no fabricated Work Insight Index.
- Type/name consistency: API method names and param order (Task 1) are used verbatim in Tasks 4-6 tests and components; `EmployeePeriodStore` members `month/from/to/label/setMonth` (Task 3) match all uses; `createWidgetLoader` returns `{data, state, reload}` used identically everywhere; `WidgetState` and the `app-widget-card` inputs come from Plan 1; the picker's `onChange` is what Task 6's test drives.
- Verified by reading source: `app-select` API (`options`, `value`, `valueChange`, `ariaLabel`, `SelectOption {value,label}`); `ErrorStateComponent` renders a retry `<button>`; Plan 1's `WidgetCardComponent` contract; existing detail-spec lines that depend on the default tab (only the default-tab test). Not compile-checked: none of this plan's code has been built or run — the executor's first test run is the first compile. Fix compile errors by aligning to the real signatures, never by weakening a test. In particular `subject.observed` (Task 2) and `store.setMonth` before `createComponent` (Tasks 4-5) are the two spots most worth watching.
- Deliberately not here: work summary, delivery, approvals, activity insights (Plan 3); upcoming items, recent activity, checklists, history events (Plan 4); a "View attendance" deep link (no employee-scoped attendance detail route exists).
