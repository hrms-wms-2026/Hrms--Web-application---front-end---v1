# Employee Overview — Upcoming, Checklists & History (Plan 4A, frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the Plan 4 models and API methods, date/time formatting helpers, and three independent Overview widgets — **Upcoming Items**, **Checklists** and **Employee History**.

**Architecture:** Same widget pattern as Plans 2/3: a standalone component + `createWidgetLoader` + `WidgetCardComponent`. These three are **lifetime / forward-looking**, so they do **not** read `EmployeePeriodStore` and never refetch on a month or comparison change.

**Tech Stack:** Angular 21 (standalone, OnPush, signal inputs), RxJS, Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/finished/2026-09-30/2026-09-30-employee-detail-redesign-design.md`. **Prerequisites:** Plans 2 and 3 frontend committed (the Overview tab, `createWidgetLoader`, `WidgetCardComponent`, `employee-overview.model.ts`, `employee-overview.utils.ts`). Backend counterparts: `HRMS-Backend-v1/docs/superpowers/plans/2026-09-30-employee-overview-{checklists-history-upcoming,recent-activity}-backend.md`. Continues in `2026-09-30-employee-overview-recent-activity-frontend.md` (Plan 4B frontend).

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Before every commit: `git branch --show-current` and `git status --short` (shared tree); stage only the task's files. **No git worktrees.**
- Test runner is **Vitest** (`vi.fn()`); component specs use globals; pure-util specs `import { describe, it, expect } from 'vitest'`. Single file: `npx ng test --watch=false --include "<spec path>"`.
- Widgets use `app-widget-card` (`src/app/shared/ui/widget-card/widget-card.component.ts`) and `createWidgetLoader`; no `rxResource`.
- **No permission logic on the frontend.** A 403 from any of these endpoints already renders as "You do not have access to this section." via the loader; do not add permission checks or new permission names.
- Time handling: all-day items (leave, release reminders) carry UTC-based timestamps and are shown by their **UTC date parts** (string slicing, no `Date` parsing, so no timezone shift); timed items (calendar events, activity) are shown in the **viewer's local time zone**, with an optional `timeZone` parameter so tests are deterministic (`'UTC'`).
- Upcoming shows the next 14 days, History the latest 10 events (constants in the widgets; the endpoints accept other values).
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Plan 4 models and API methods

**Files:**
- Modify: `src/app/modules/people/models/employee-overview.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Modify (test): `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces (models): `EmployeeUpcomingKind`, `EmployeeUpcomingItem`, `EmployeeUpcomingResponse`, `EmployeeChecklistGroup`, `EmployeeChecklistOverviewResponse`, `EmployeeHistoryEvent`, `EmployeeHistoryResponse`, `EmployeeActivityItem`, `EmployeeRecentActivityResponse`.
- Produces on `PeopleApiService`:
  - `getOverviewUpcoming(employeeId: string, days = 14): Observable<EmployeeUpcomingResponse>`
  - `getOverviewChecklists(employeeId: string): Observable<EmployeeChecklistOverviewResponse>`
  - `getOverviewHistory(employeeId: string, limit = 10): Observable<EmployeeHistoryResponse>`
  - `getOverviewRecentActivity(employeeId: string, before?: string | null, limit = 20): Observable<EmployeeRecentActivityResponse>`

- [ ] **Step 1: Write the failing tests**

Add inside the top-level `describe('PeopleApiService', …)` in `people-api.service.spec.ts` (the `overviewUrl` helper from Plan 3A already exists in that file; if it does not, define `const overviewUrl = (path: string) => (r: { url: string }) => r.url === \`${environment.apiUrl}/employees/emp-1/overview/${path}\`;` once at the top of the describe):

```ts
  it('getOverviewUpcoming sends days, defaulting to 14', () => {
    service.getOverviewUpcoming('emp-1').subscribe();
    const byDefault = httpMock.expectOne(overviewUrl('upcoming'));
    expect(byDefault.request.method).toBe('GET');
    expect(byDefault.request.params.get('days')).toBe('14');
    byDefault.flush({});

    service.getOverviewUpcoming('emp-1', 30).subscribe();
    const custom = httpMock.expectOne(overviewUrl('upcoming'));
    expect(custom.request.params.get('days')).toBe('30');
    custom.flush({});
  });

  it('getOverviewChecklists GETs overview/checklists with no parameters', () => {
    service.getOverviewChecklists('emp-1').subscribe();

    const req = httpMock.expectOne(overviewUrl('checklists'));
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });

  it('getOverviewHistory sends limit, defaulting to 10', () => {
    service.getOverviewHistory('emp-1').subscribe();
    const byDefault = httpMock.expectOne(overviewUrl('history'));
    expect(byDefault.request.params.get('limit')).toBe('10');
    byDefault.flush({});

    service.getOverviewHistory('emp-1', 25).subscribe();
    const custom = httpMock.expectOne(overviewUrl('history'));
    expect(custom.request.params.get('limit')).toBe('25');
    custom.flush({});
  });

  it('getOverviewRecentActivity sends limit, and before only when given', () => {
    service.getOverviewRecentActivity('emp-1').subscribe();
    const first = httpMock.expectOne(overviewUrl('recent-activity'));
    expect(first.request.params.get('limit')).toBe('20');
    expect(first.request.params.has('before')).toBe(false);
    first.flush({});

    service.getOverviewRecentActivity('emp-1', '2026-09-20T00:00:00+00:00', 5).subscribe();
    const older = httpMock.expectOne(overviewUrl('recent-activity'));
    expect(older.request.params.get('before')).toBe('2026-09-20T00:00:00+00:00');
    expect(older.request.params.get('limit')).toBe('5');
    older.flush({});

    service.getOverviewRecentActivity('emp-1', null).subscribe();
    expect(httpMock.expectOne(overviewUrl('recent-activity')).request.params.has('before')).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: FAIL — the four methods do not exist.

- [ ] **Step 3: Add the models**

Append to `employee-overview.model.ts`:

```ts
export type EmployeeUpcomingKind = 'calendar' | 'leave' | 'release';

/** All-day items (leave, releases) carry UTC-based timestamps; calendar events are real instants. */
export interface EmployeeUpcomingItem {
  readonly kind: EmployeeUpcomingKind;
  readonly title: string;
  readonly start: string;
  readonly end: string | null;
  readonly isAllDay: boolean;
  readonly detail: string | null;
}

/** Mirrors HRMS-Backend-v1 EmployeeUpcomingResponse (max 10 items, earliest first). */
export interface EmployeeUpcomingResponse {
  readonly from: string;
  readonly to: string;
  readonly items: readonly EmployeeUpcomingItem[];
}

/** Bypassed tasks count in total but not in completed. */
export interface EmployeeChecklistGroup {
  readonly name: string;
  readonly lifecycleType: string;
  readonly completed: number;
  readonly bypassed: number;
  readonly total: number;
}

export interface EmployeeChecklistOverviewResponse {
  readonly groups: readonly EmployeeChecklistGroup[];
}

/** kind: joined | probation_completed | position_changed | manager_changed | leave_approved | checklist_completed | terminated. date is a UTC YYYY-MM-DD. */
export interface EmployeeHistoryEvent {
  readonly kind: string;
  readonly title: string;
  readonly detail: string | null;
  readonly date: string;
}

export interface EmployeeHistoryResponse {
  readonly events: readonly EmployeeHistoryEvent[];
}

/** One thing the employee did. Never contains text the employee typed. */
export interface EmployeeActivityItem {
  readonly id: string;
  readonly kind: string;
  readonly action: string;
  readonly target: string | null;
  readonly detail: string | null;
  readonly at: string;
}

/** nextBefore is the cursor for the next (older) page; isPartial is true while the feed is a union over existing tables. */
export interface EmployeeRecentActivityResponse {
  readonly items: readonly EmployeeActivityItem[];
  readonly nextBefore: string | null;
  readonly isPartial: boolean;
}
```

- [ ] **Step 4: Add the API methods**

In `people-api.service.ts` extend the overview model import with `EmployeeChecklistOverviewResponse`, `EmployeeHistoryResponse`, `EmployeeRecentActivityResponse`, `EmployeeUpcomingResponse`, and add next to the other overview methods:

```ts
  getOverviewUpcoming(employeeId: string, days = 14): Observable<EmployeeUpcomingResponse> {
    return this.http.get<EmployeeUpcomingResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/upcoming`,
      { params: new HttpParams().set('days', String(days)) }
    );
  }

  getOverviewChecklists(employeeId: string): Observable<EmployeeChecklistOverviewResponse> {
    return this.http.get<EmployeeChecklistOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/checklists`
    );
  }

  getOverviewHistory(employeeId: string, limit = 10): Observable<EmployeeHistoryResponse> {
    return this.http.get<EmployeeHistoryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/history`,
      { params: new HttpParams().set('limit', String(limit)) }
    );
  }

  getOverviewRecentActivity(
    employeeId: string,
    before?: string | null,
    limit = 20
  ): Observable<EmployeeRecentActivityResponse> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) {
      params = params.set('before', before);
    }
    return this.http.get<EmployeeRecentActivityResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/recent-activity`,
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
git commit -m "feat(people): add plan 4 overview models and API methods

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Date, time and progress helpers

**Files:**
- Modify: `src/app/modules/people/utils/employee-overview.utils.ts` (+ `employee-overview.utils.spec.ts`)

**Interfaces:**
- Consumes: existing `formatShortDate`, `formatLeaveRange` (Plans 2/3A).
- Produces (all exported from `employee-overview.utils.ts`):
  - `formatEventTime(iso: string, timeZone?: string): string` — 24-hour `HH:mm` in `timeZone` (default: viewer's local)
  - `formatUpcomingWhen(item: EmployeeUpcomingItem, timeZone?: string): string` — all-day: `Sep 23`, `Sep 23 – 25` (UTC date parts); timed: `Sep 30 · 09:00` (local date + time)
  - `formatActivityWhen(iso: string, now: Date, timeZone?: string): string` — `Today, 14:41`, `Yesterday, 18:12`, `Sep 16, 16:32`
  - `formatDateWithYear(isoDate: string): string` — `Sep 10, 2026`
  - `progressPercent(part: number, whole: number): number` — 0..100, whole 0 → 0

- [ ] **Step 1: Write the failing tests**

Add `EmployeeUpcomingItem` to the model import in `employee-overview.utils.spec.ts` (or import the type inline) and the new names to the utils import, then append:

```ts
import { EmployeeUpcomingItem } from '../models/employee-overview.model';

describe('formatEventTime', () => {
  it('formats a 24-hour time in the given time zone', () => {
    expect(formatEventTime('2026-09-30T09:05:00+00:00', 'UTC')).toBe('09:05');
    expect(formatEventTime('2026-09-30T09:05:00+00:00', 'Asia/Colombo')).toBe('14:35');
  });
});

describe('formatUpcomingWhen', () => {
  const item = (over: Partial<EmployeeUpcomingItem>): EmployeeUpcomingItem => ({
    kind: 'calendar', title: 't', start: '2026-09-30T09:00:00+00:00', end: '2026-09-30T10:00:00+00:00', isAllDay: false, detail: null, ...over
  });

  it('shows date and time for a timed event', () => {
    expect(formatUpcomingWhen(item({}), 'UTC')).toBe('Sep 30 · 09:00');
  });

  it('shows a single date for an all-day item with no end', () => {
    expect(formatUpcomingWhen(item({ kind: 'release', isAllDay: true, start: '2026-10-01T00:00:00+00:00', end: null }))).toBe('Oct 1');
  });

  it('shows a range for multi-day leave, collapsing same-month ranges, by UTC date parts', () => {
    expect(formatUpcomingWhen(item({ kind: 'leave', isAllDay: true, start: '2026-09-23T00:00:00+00:00', end: '2026-09-25T23:59:59+00:00' }))).toBe('Sep 23 – 25');
    expect(formatUpcomingWhen(item({ kind: 'leave', isAllDay: true, start: '2026-09-30T00:00:00+00:00', end: '2026-10-02T23:59:59+00:00' }))).toBe('Sep 30 – Oct 2');
  });

  it('shows one date for a one-day all-day item', () => {
    expect(formatUpcomingWhen(item({ kind: 'leave', isAllDay: true, start: '2026-09-23T00:00:00+00:00', end: '2026-09-23T23:59:59+00:00' }))).toBe('Sep 23');
  });
});

describe('formatActivityWhen', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('says Today and Yesterday, then falls back to the date', () => {
    expect(formatActivityWhen('2026-09-30T08:41:00+00:00', now, 'UTC')).toBe('Today, 08:41');
    expect(formatActivityWhen('2026-09-29T18:12:00+00:00', now, 'UTC')).toBe('Yesterday, 18:12');
    expect(formatActivityWhen('2026-09-16T16:32:00+00:00', now, 'UTC')).toBe('Sep 16, 16:32');
  });

  it('decides today/yesterday in the given time zone', () => {
    // 20:00Z on the 29th is already the 30th in Colombo (UTC+5:30).
    expect(formatActivityWhen('2026-09-29T20:00:00+00:00', now, 'Asia/Colombo')).toBe('Today, 01:30');
  });

  it('handles month boundaries when working out yesterday', () => {
    expect(formatActivityWhen('2026-09-30T23:00:00+00:00', new Date('2026-10-01T05:00:00Z'), 'UTC')).toBe('Yesterday, 23:00');
  });
});

describe('formatDateWithYear', () => {
  it('formats a date with its year from string parts', () => {
    expect(formatDateWithYear('2026-09-10')).toBe('Sep 10, 2026');
    expect(formatDateWithYear('2024-02-01')).toBe('Feb 1, 2024');
  });
});

describe('progressPercent', () => {
  it('returns 0 for an empty whole and clamps to 0..100', () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 4)).toBe(25);
    expect(progressPercent(5, 4)).toBe(100);
    expect(progressPercent(-1, 4)).toBe(0);
  });
});
```

(Import the new function names from `./employee-overview.utils` at the top of the spec: `formatActivityWhen, formatDateWithYear, formatEventTime, formatUpcomingWhen, progressPercent`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-overview.utils.spec.ts"`
Expected: FAIL — the five helpers are not exported.

- [ ] **Step 3: Add the helpers**

In `employee-overview.utils.ts` add `EmployeeUpcomingItem` to the model import (the file already imports `AttendanceDayStatus` from `../models/employee-overview.model`) and append:

```ts
/** 24-hour 'HH:mm' in the given time zone (default: the viewer's local zone). */
export function formatEventTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
}

/** 'YYYY-MM-DD' of an instant in the given time zone ('en-CA' formats dates as ISO). */
function zonedDateKey(iso: string | Date, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

/** When an upcoming item happens: all-day items by UTC date parts, timed items in the viewer's zone. */
export function formatUpcomingWhen(item: EmployeeUpcomingItem, timeZone?: string): string {
  if (item.isAllDay) {
    const startDay = item.start.slice(0, 10);
    const endDay = item.end ? item.end.slice(0, 10) : startDay;
    return startDay === endDay ? formatShortDate(startDay) : formatLeaveRange(startDay, endDay);
  }
  return `${formatShortDate(zonedDateKey(item.start, timeZone))} · ${formatEventTime(item.start, timeZone)}`;
}

/** 'Today, 14:41' / 'Yesterday, 18:12' / 'Sep 16, 16:32', deciding the day in the given zone. */
export function formatActivityWhen(iso: string, now: Date, timeZone?: string): string {
  const day = zonedDateKey(iso, timeZone);
  const today = zonedDateKey(now, timeZone);
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const time = formatEventTime(iso, timeZone);
  if (day === today) return `Today, ${time}`;
  if (day === yesterday) return `Yesterday, ${time}`;
  return `${formatShortDate(day)}, ${time}`;
}

/** 'Sep 10, 2026' from an ISO date (string parts, no Date parsing). */
export function formatDateWithYear(isoDate: string): string {
  return `${formatShortDate(isoDate)}, ${isoDate.slice(0, 4)}`;
}

export function progressPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: same command as Step 2. Expected: PASS (all previous utils tests plus the new ones). If a `toLocaleTimeString` result differs in your Node build (e.g. `24:05` for midnight), keep `hour12: false` and add `hourCycle: 'h23'` to the options object — the tests avoid midnight so they are unaffected.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/utils/employee-overview.utils.ts src/app/modules/people/utils/employee-overview.utils.spec.ts
git commit -m "feat(people): add upcoming, activity and history date helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Upcoming, Checklists and Employee History widgets

**Files:**
- Create: `src/app/modules/people/ui/overview-upcoming-widget/overview-upcoming-widget.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/overview-checklists-widget/overview-checklists-widget.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/overview-history-widget/overview-history-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `createWidgetLoader`, `WidgetCardComponent`, the Task 1 API methods, the Task 2 helpers.
- Produces: `<app-overview-upcoming-widget [employeeId]>`, `<app-overview-checklists-widget [employeeId]>`, `<app-overview-history-widget [employeeId]>` (required `employeeId: string`; none reads the period store, none refetches on month/compare change).

- [ ] **Step 1: Write the failing Upcoming test**

`overview-upcoming-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeUpcomingResponse } from '../../models/employee-overview.model';
import { OverviewUpcomingWidgetComponent } from './overview-upcoming-widget.component';

describe('OverviewUpcomingWidgetComponent', () => {
  const response: EmployeeUpcomingResponse = {
    from: '2026-09-30',
    to: '2026-10-14',
    items: [
      { kind: 'release', title: 'v2.0', start: '2026-10-01T00:00:00+00:00', end: null, isAllDay: true, detail: 'Website' },
      { kind: 'calendar', title: 'Team meeting', start: '2026-10-03T09:00:00+00:00', end: '2026-10-03T10:00:00+00:00', isAllDay: false, detail: 'Room 4' },
      { kind: 'leave', title: 'Annual leave', start: '2026-10-06T00:00:00+00:00', end: '2026-10-08T23:59:59+00:00', isAllDay: true, detail: 'Approved' }
    ]
  };

  function setup(getOverviewUpcoming: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewUpcomingWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewUpcoming } }]
    });
    const fixture = TestBed.createComponent(OverviewUpcomingWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the next 14 days for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', 14);
  });

  it('lists each item with its title and a kind chip, in the order returned', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('v2.0');
    expect(rows[0].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Release');
    expect(rows[1].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Calendar');
    expect(rows[2].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Approved');
  });

  it('shows the date for all-day items and the detail line when present', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows[0].textContent).toContain('Oct 1');
    expect(rows[0].textContent).toContain('Website');
    expect(rows[2].textContent).toContain('Oct 6 – 8');
  });

  it('tags each chip with its kind class', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const chips = el.querySelectorAll('[data-testid="upcoming-chip"]');

    expect(chips[0].classList.contains('chip--release')).toBe(true);
    expect(chips[1].classList.contains('chip--calendar')).toBe(true);
    expect(chips[2].classList.contains('chip--leave')).toBe(true);
  });

  it('shows the empty state when nothing is coming up', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, items: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Nothing coming up');
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-upcoming-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the Upcoming widget**

`overview-upcoming-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeUpcomingItem, EmployeeUpcomingKind } from '../../models/employee-overview.model';
import { formatUpcomingWhen } from '../../utils/employee-overview.utils';

const UPCOMING_DAYS = 14;

const CHIP_LABELS: Record<EmployeeUpcomingKind, string> = {
  calendar: 'Calendar',
  leave: 'Approved',
  release: 'Release'
};

/** Forward-looking: not period-aware, so it never refetches when the month changes. */
@Component({
  selector: 'app-overview-upcoming-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Upcoming Items"
      [state]="loader.state()"
      errorMessage="Could not load upcoming items."
      emptyMessage="Nothing coming up in the next 14 days."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of d.items; track $index) {
            <li class="flex items-start justify-between gap-3 py-2 text-sm" data-testid="upcoming-item">
              <div class="min-w-0">
                <p class="truncate font-medium text-[var(--color-text-primary)]">{{ item.title }}</p>
                <p class="text-xs text-[var(--color-text-secondary)]">
                  {{ when(item) }}@if (item.detail && item.kind !== 'leave') { · {{ item.detail }} }
                </p>
              </div>
              <span class="chip" data-testid="upcoming-chip" [class]="'chip--' + item.kind">{{ chip(item.kind) }}</span>
            </li>
          }
        </ul>
      }
    </app-widget-card>
  `,
  styles: [`
    .chip { flex-shrink: 0; border-radius: 9999px; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; }
    .chip--calendar { background: #dbeafe; color: #1e40af; }
    .chip--leave { background: #dcfce7; color: #166534; }
    .chip--release { background: #ede9fe; color: #5b21b6; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewUpcomingWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewUpcoming(this.employeeId(), UPCOMING_DAYS),
    { isEmpty: (v) => v.items.length === 0 }
  );

  when(item: EmployeeUpcomingItem): string {
    return formatUpcomingWhen(item);
  }

  chip(kind: EmployeeUpcomingKind): string {
    return CHIP_LABELS[kind];
  }
}
```

- [ ] **Step 4: Run to verify the Upcoming tests pass**

Run: same command as Step 2. Expected: 6 passed.

- [ ] **Step 5: Write the failing Checklists test**

`overview-checklists-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeChecklistOverviewResponse } from '../../models/employee-overview.model';
import { OverviewChecklistsWidgetComponent } from './overview-checklists-widget.component';

describe('OverviewChecklistsWidgetComponent', () => {
  const response: EmployeeChecklistOverviewResponse = {
    groups: [
      { name: 'Onboarding', lifecycleType: 'onboarding', completed: 6, bypassed: 0, total: 8 },
      { name: 'Security training', lifecycleType: 'onboarding', completed: 2, bypassed: 0, total: 2 },
      { name: 'Equipment setup', lifecycleType: 'onboarding', completed: 1, bypassed: 1, total: 3 }
    ]
  };

  function setup(getOverviewChecklists: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewChecklistsWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewChecklists } }]
    });
    const fixture = TestBed.createComponent(OverviewChecklistsWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the checklists for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1');
  });

  it('shows each group with its completed / total count', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="checklist-group"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Onboarding');
    expect(rows[0].textContent).toContain('6 / 8');
    expect(rows[1].textContent).toContain('2 / 2');
  });

  it('sizes each progress bar by completed over total', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const width = (i: number) => (el.querySelectorAll('[data-testid="checklist-bar"]')[i] as HTMLElement).style.width;

    expect(width(0)).toBe('75%');
    expect(width(1)).toBe('100%');
    expect(parseFloat(width(2))).toBeCloseTo(33.33, 1);
  });

  it('notes bypassed tasks separately and marks a finished group', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="checklist-group"]');

    expect(rows[2].textContent).toContain('1 bypassed');
    expect(rows[0].textContent).not.toContain('bypassed');
    expect(rows[1].classList.contains('group--done')).toBe(true);
    expect(rows[0].classList.contains('group--done')).toBe(false);
  });

  it('gives each bar an accessible label', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelectorAll('[role="progressbar"]')[0].getAttribute('aria-label')).toBe('Onboarding: 6 of 8 completed');
  });

  it('shows the empty state when there are no checklist tasks', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ groups: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-checklists-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 7: Write the Checklists widget**

`overview-checklists-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeChecklistGroup } from '../../models/employee-overview.model';
import { progressPercent } from '../../utils/employee-overview.utils';

/** Lifetime view of onboarding/offboarding checklist progress; not period-aware. */
@Component({
  selector: 'app-overview-checklists-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Checklists"
      [state]="loader.state()"
      errorMessage="Could not load checklists."
      emptyMessage="No checklist tasks."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="space-y-4">
          @for (group of d.groups; track group.lifecycleType + group.name) {
            <li data-testid="checklist-group" [class.group--done]="isDone(group)">
              <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span class="font-medium text-[var(--color-text-primary)]">{{ group.name }}</span>
                <span class="text-xs text-[var(--color-text-secondary)]">
                  {{ group.completed }} / {{ group.total }}@if (group.bypassed > 0) { · {{ group.bypassed }} bypassed }
                </span>
              </div>
              <div
                class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]"
                role="progressbar"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="group.total"
                [attr.aria-valuenow]="group.completed"
                [attr.aria-label]="group.name + ': ' + group.completed + ' of ' + group.total + ' completed'"
              >
                <div class="bar" data-testid="checklist-bar" [class.bar--done]="isDone(group)" [style.width.%]="percent(group)"></div>
              </div>
            </li>
          }
        </ul>
      }
    </app-widget-card>
  `,
  styles: [`
    .bar { height: 100%; background: #3b82f6; }
    .bar--done { background: #16a34a; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewChecklistsWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewChecklists(this.employeeId()),
    { isEmpty: (v) => v.groups.length === 0 }
  );

  percent(group: EmployeeChecklistGroup): number {
    return progressPercent(group.completed, group.total);
  }

  isDone(group: EmployeeChecklistGroup): boolean {
    return group.total > 0 && group.completed === group.total;
  }
}
```

- [ ] **Step 8: Run to verify the Checklists tests pass**

Run: same command as Step 6. Expected: 7 passed.

- [ ] **Step 9: Write the failing History test**

`overview-history-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeHistoryResponse } from '../../models/employee-overview.model';
import { OverviewHistoryWidgetComponent } from './overview-history-widget.component';

describe('OverviewHistoryWidgetComponent', () => {
  const response: EmployeeHistoryResponse = {
    events: [
      { kind: 'position_changed', title: 'Position changed', detail: 'Senior → Watercraft Engineer', date: '2025-09-10' },
      { kind: 'leave_approved', title: 'Leave approved', detail: 'Annual leave (24 h)', date: '2025-08-28' },
      { kind: 'joined', title: 'Joined company', detail: null, date: '2024-02-01' }
    ]
  };

  function setup(getOverviewHistory: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewHistoryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewHistory } }]
    });
    const fixture = TestBed.createComponent(OverviewHistoryWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the latest 10 events for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', 10);
  });

  it('lists each event with its title, detail and dated with a year', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="history-event"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Position changed');
    expect(rows[0].textContent).toContain('Senior → Watercraft Engineer');
    expect(rows[0].textContent).toContain('Sep 10, 2025');
    expect(rows[2].textContent).toContain('Joined company');
    expect(rows[2].textContent).toContain('Feb 1, 2024');
  });

  it('omits the detail line when there is none', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const joined = el.querySelectorAll('[data-testid="history-event"]')[2];

    expect(joined.querySelectorAll('[data-testid="history-detail"]')).toHaveLength(0);
  });

  it('shows the empty state when there is no history', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ events: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 10: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-history-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 11: Write the History widget**

`overview-history-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatDateWithYear } from '../../utils/employee-overview.utils';

const HISTORY_LIMIT = 10;

/**
 * Lifetime timeline of recorded employment events. Employment status/type/work-mode changes are
 * not recorded anywhere, so they cannot appear here.
 */
@Component({
  selector: 'app-overview-history-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Employee History"
      [state]="loader.state()"
      errorMessage="Could not load employee history."
      emptyMessage="No history recorded yet."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ol class="relative ml-2 space-y-4 border-l border-[var(--color-border)] pl-4">
          @for (event of d.events; track $index) {
            <li class="relative text-sm" data-testid="history-event">
              <span class="dot" aria-hidden="true"></span>
              <p class="font-medium text-[var(--color-text-primary)]">{{ event.title }}</p>
              @if (event.detail) {
                <p class="text-xs text-[var(--color-text-secondary)]" data-testid="history-detail">{{ event.detail }}</p>
              }
              <p class="text-xs text-[var(--color-text-secondary)]">{{ dated(event.date) }}</p>
            </li>
          }
        </ol>
      }
    </app-widget-card>
  `,
  styles: [`
    .dot { position: absolute; left: -1.3125rem; top: 0.3rem; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: var(--color-accent); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewHistoryWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewHistory(this.employeeId(), HISTORY_LIMIT),
    { isEmpty: (v) => v.events.length === 0 }
  );

  dated = formatDateWithYear;
}
```

- [ ] **Step 12: Run to verify the History tests pass, then all three specs together**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-upcoming-widget/*.spec.ts" --include "src/app/modules/people/ui/overview-checklists-widget/*.spec.ts" --include "src/app/modules/people/ui/overview-history-widget/*.spec.ts"`
Expected: 6 + 7 + 5 passed.

- [ ] **Step 13: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-upcoming-widget src/app/modules/people/ui/overview-checklists-widget src/app/modules/people/ui/overview-history-widget
git commit -m "feat(people): add overview upcoming, checklists and history widgets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- Covers the user's list on the frontend: Upcoming items (calendar, leave, releases), checklists, employment history events. Recent Activity (with paging) and the tab layout are Plan 4B frontend.
- No permission decisions are made here; 403s render as the shared "no access" state.
- Type/name consistency: API argument shapes (T1) match the widget calls and specs (`getOverviewUpcoming(id, 14)`, `getOverviewHistory(id, 10)`, `getOverviewChecklists(id)`); model field names are the backend records in camelCase; helper names/signatures (T2) match their uses (`formatUpcomingWhen(item)` in the widget, `formatDateWithYear` in the history widget, `progressPercent` in the checklist widget).
- Verified by reading source: `createWidgetLoader`/`WidgetCardComponent` contracts and the Plan 3 Overview tab as committed; `formatShortDate`/`formatLeaveRange` exist from Plans 2/3A. Not compile-checked or run: the executor's first test run is the first compile. Fix compile errors by aligning to real signatures, never by weakening a test.
- Known limits: Upcoming lists at most 10 items over 14 days; History has no "view all"; the Checklists widget groups by task category (falls back to the lifecycle name) exactly as the backend returns it.
