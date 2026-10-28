# Employee Overview — Foundations, Work & Delivery (Plan 3A, frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the frontend foundations Plan 3 needs — Plan 3 models and API methods, a "compare to previous period" setting in the period store with its picker, delta helpers and a delta badge — plus the **Work Management** and **Delivery** widgets.

**Architecture:** Same pattern as Plan 2: a widget = standalone component + `createWidgetLoader` + `WidgetCardComponent`, reading the tab-scoped `EmployeePeriodStore`. The store gains `compare` (`none | previous`); comparison-capable widgets pass `comparePrevious` to the API and render a `DeltaBadgeComponent` next to each figure when the response carries `previous`.

**Tech Stack:** Angular 21 (standalone, OnPush, signal inputs), `@ngrx/signals`, RxJS, Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/finished/2026-09-30/2026-09-30-employee-detail-redesign-design.md`. Prerequisite: Plan 2 frontend committed (Overview tab, `EmployeePeriodStore`, `createWidgetLoader`, `employee-overview.model.ts`, `employee-overview.utils.ts`). Backend counterparts: `HRMS-Backend-v1/docs/superpowers/plans/2026-09-30-employee-overview-{work-delivery,activity-discipline,approvals}-backend.md`. Continues in `2026-09-30-employee-overview-insights-approvals-frontend.md` (Plan 3B frontend).

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Before every commit: `git branch --show-current` and `git status --short` (shared tree); stage only the task's files. **No git worktrees.**
- Test runner is **Vitest** (`vi.fn()`); component specs use globals; pure-util specs `import { describe, it, expect } from 'vitest'`. Single file: `npx ng test --watch=false --include "<spec path>"`.
- Widgets always use `app-widget-card` (`src/app/shared/ui/widget-card/widget-card.component.ts`) and `createWidgetLoader` (`.../widget-loader.ts`). No `rxResource`.
- API dates are inclusive `YYYY-MM-DD`; `compare=previous` is sent only when the store says so.
- Colors use existing CSS variables; fixed hexes only for status semantics declared once per component.
- Do not show a Work Insight Index or any figure without a real data source.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Plan 3 models and API methods

**Files:**
- Modify: `src/app/modules/people/models/employee-overview.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Modify (test): `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces (models): `EmployeeWorkOverviewResponse`, `EmployeeDeliveryMetrics`, `EmployeeDeliveryResponse`, `EmployeeActivityMetrics`, `EmployeeActivityOverviewResponse`, `EmployeeAttendanceDisciplineMetrics`, `ApprovalStatus`, `EmployeeApprovalItem`, `EmployeeApprovalActivityResponse`; `EmployeeAttendanceDisciplineResponse` gains optional `previous`.
- Produces on `PeopleApiService`:
  - `getOverviewWork(employeeId: string, from: string, to: string): Observable<EmployeeWorkOverviewResponse>`
  - `getOverviewDelivery(employeeId: string, from: string, to: string, comparePrevious = false): Observable<EmployeeDeliveryResponse>`
  - `getOverviewActivity(employeeId: string, from: string, to: string, comparePrevious = false): Observable<EmployeeActivityOverviewResponse>`
  - `getOverviewApprovals(employeeId: string, from: string, to: string): Observable<EmployeeApprovalActivityResponse>`
  - `getOverviewAttendanceDiscipline(employeeId, from, to, comparePrevious = false)` (existing method gains the 4th parameter).

- [ ] **Step 1: Write the failing tests**

Add inside the top-level `describe('PeopleApiService', …)` in `people-api.service.spec.ts`:

```ts
  const overviewUrl = (path: string) => (r: { url: string }) =>
    r.url === `${environment.apiUrl}/employees/emp-1/overview/${path}`;

  it('getOverviewWork GETs overview/work with from and to only', () => {
    service.getOverviewWork('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(overviewUrl('work'));
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    expect(req.request.params.has('compare')).toBe(false);
    req.flush({});
  });

  it.each([
    ['getOverviewDelivery', 'delivery'],
    ['getOverviewActivity', 'activity'],
    ['getOverviewAttendanceDiscipline', 'attendance-discipline']
  ] as const)('%s sends compare=previous only when asked', (method, path) => {
    const call = (compare?: boolean) =>
      (service[method] as (id: string, from: string, to: string, compare?: boolean) => any)
        .call(service, 'emp-1', '2026-09-01', '2026-09-30', compare);

    call().subscribe();
    const off = httpMock.expectOne(overviewUrl(path));
    expect(off.request.params.has('compare')).toBe(false);
    off.flush({});

    call(true).subscribe();
    const on = httpMock.expectOne(overviewUrl(path));
    expect(on.request.params.get('compare')).toBe('previous');
    expect(on.request.params.get('from')).toBe('2026-09-01');
    on.flush({});
  });

  it('getOverviewApprovals GETs overview/approvals with from and to', () => {
    service.getOverviewApprovals('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(overviewUrl('approvals'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    req.flush({});
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: FAIL — the new methods do not exist (and the discipline method takes 3 arguments).

- [ ] **Step 3: Add the models**

Append to `employee-overview.model.ts`:

```ts
/** Mirrors HRMS-Backend-v1 EmployeeWorkOverviewResponse. onTimeRatePercent is null when no completed task has both dates. */
export interface EmployeeWorkOverviewResponse {
  readonly from: string;
  readonly to: string;
  readonly assigned: number;
  readonly completed: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly notStarted: number;
  readonly completionRatePercent: number;
  readonly onTimeRatePercent: number | null;
}

export interface EmployeeDeliveryMetrics {
  readonly tasksAssigned: number;
  readonly tasksCompleted: number;
  readonly onTimeCompleted: number;
  readonly completedWithDueDate: number;
  readonly storyPointsAssigned: number;
  readonly storyPointsCompleted: number;
}

/** Flat current-period metrics plus previous-period metrics when compare=previous was requested. */
export interface EmployeeDeliveryResponse extends EmployeeDeliveryMetrics {
  readonly from: string;
  readonly to: string;
  readonly previous: EmployeeDeliveryMetrics | null;
}

export interface EmployeeActivityMetrics {
  readonly activeMinutes: number;
  readonly idleMinutes: number;
  readonly meetingMinutes: number;
  readonly daysWithData: number;
}

/** When activityMonitoringEnabled is false every figure is 0 and previous is null. */
export interface EmployeeActivityOverviewResponse extends EmployeeActivityMetrics {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly previous: EmployeeActivityMetrics | null;
}

export interface EmployeeAttendanceDisciplineMetrics {
  readonly lateClockIns: number;
  readonly earlyClockOuts: number;
  readonly missingClockOuts: number;
  readonly overBreakDays: number;
  readonly overBreakMinutes: number;
  readonly locationViolations: number | null;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EmployeeApprovalItem {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly detail: string | null;
  readonly status: ApprovalStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
  /** Only known for Work Management requests. */
  readonly approverName: string | null;
}

/** Mirrors EmployeeApprovalActivityResponse: newest 10 items, counts cover every match. */
export interface EmployeeApprovalActivityResponse {
  readonly from: string;
  readonly to: string;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly total: number;
  readonly items: readonly EmployeeApprovalItem[];
}
```

and extend the existing discipline response — replace the line

```ts
  readonly locationViolations: number | null;
```
(the one inside `EmployeeAttendanceDisciplineResponse`, which is the only place that exact line occurs) with:

```ts
  readonly locationViolations: number | null;
  /** Present when compare=previous was requested. */
  readonly previous?: EmployeeAttendanceDisciplineMetrics | null;
```

- [ ] **Step 4: Add the API methods**

In `people-api.service.ts`, extend the overview model import to include the new response types:

```ts
import {
  EmployeeActivityOverviewResponse,
  EmployeeApprovalActivityResponse,
  EmployeeAttendanceDisciplineResponse,
  EmployeeAttendanceOverviewResponse,
  EmployeeDeliveryResponse,
  EmployeeTimeOffResponse,
  EmployeeWorkOverviewResponse
} from '../models/employee-overview.model';
```

Replace the existing `getOverviewAttendanceDiscipline` method with the version below (re-read the file first; if Plan 2's formatting differs, replace the whole method whatever its formatting) and add the four new methods after it:

```ts
  getOverviewAttendanceDiscipline(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeAttendanceDisciplineResponse> {
    return this.http.get<EmployeeAttendanceDisciplineResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/attendance-discipline`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewWork(employeeId: string, from: string, to: string): Observable<EmployeeWorkOverviewResponse> {
    return this.http.get<EmployeeWorkOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/work`,
      { params: this.periodParams(from, to, false) }
    );
  }

  getOverviewDelivery(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeDeliveryResponse> {
    return this.http.get<EmployeeDeliveryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/delivery`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewActivity(
    employeeId: string,
    from: string,
    to: string,
    comparePrevious = false
  ): Observable<EmployeeActivityOverviewResponse> {
    return this.http.get<EmployeeActivityOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/activity`,
      { params: this.periodParams(from, to, comparePrevious) }
    );
  }

  getOverviewApprovals(employeeId: string, from: string, to: string): Observable<EmployeeApprovalActivityResponse> {
    return this.http.get<EmployeeApprovalActivityResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/approvals`,
      { params: this.periodParams(from, to, false) }
    );
  }

  private periodParams(from: string, to: string, comparePrevious: boolean): HttpParams {
    const params = new HttpParams().set('from', from).set('to', to);
    return comparePrevious ? params.set('compare', 'previous') : params;
  }
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: PASS (whole file, including Plan 2's discipline test which still sees only `from`/`to` when compare is off).

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/models/employee-overview.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat(people): add plan 3 overview models and API methods

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Delta helpers, store `compare`, compare picker, delta badge

**Files:**
- Modify: `src/app/modules/people/utils/employee-overview.utils.ts` (+ `employee-overview.utils.spec.ts`)
- Modify (full rewrite): `src/app/modules/people/state/employee-period.store.ts`
- Test (new): `src/app/modules/people/state/employee-period.store.compare.spec.ts`
- Create: `src/app/modules/people/ui/employee-compare-picker/employee-compare-picker.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/delta-badge/delta-badge.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces in `employee-overview.utils.ts`:
  - `formatMinutes(total: number): string` — `2h 05m`, `83h 20m`, `0h 00m`
  - `type DeltaPolarity = 'higher-better' | 'lower-better' | 'neutral'`
  - `interface Delta { readonly text: string; readonly direction: 'up' | 'down' | 'flat'; readonly tone: 'good' | 'bad' | 'neutral' }`
  - `computeDelta(current: number, previous: number, polarity: DeltaPolarity, format?: (n: number) => string): Delta`
  - `formatShortDate(iso: string): string` — `'2026-09-12T09:00:00+00:00'` → `Sep 12` (string parts, no Date parsing)
- `EmployeePeriodStore`: state gains `compare: 'none' | 'previous'`; computed `comparePrevious: boolean`; method `setCompare(compare: 'none' | 'previous'): void`; `setMonth` unchanged.
- `<app-employee-compare-picker>` (reads/writes the store; `options`, `onChange(value: string)`); `<app-delta-badge [delta]>` (`delta: Delta | null`; renders nothing for null).

- [ ] **Step 1: Write the failing util tests**

In `employee-overview.utils.spec.ts` add the new names to the existing import from `./employee-overview.utils` (`computeDelta`, `formatMinutes`, `formatShortDate`) and append at the end of the file:

```ts
describe('formatMinutes', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatMinutes(0)).toBe('0h 00m');
    expect(formatMinutes(65)).toBe('1h 05m');
    expect(formatMinutes(150)).toBe('2h 30m');
    expect(formatMinutes(4999)).toBe('83h 19m');
  });

  it('clamps negatives and rounds fractions', () => {
    expect(formatMinutes(-5)).toBe('0h 00m');
    expect(formatMinutes(59.6)).toBe('1h 00m');
  });
});

describe('computeDelta', () => {
  it('reports no change as flat and neutral', () => {
    expect(computeDelta(5, 5, 'higher-better')).toEqual({ text: 'No change', direction: 'flat', tone: 'neutral' });
  });

  it('marks an increase good when higher is better and bad when lower is better', () => {
    expect(computeDelta(10, 8, 'higher-better')).toEqual({ text: '+2', direction: 'up', tone: 'good' });
    expect(computeDelta(10, 8, 'lower-better')).toEqual({ text: '+2', direction: 'up', tone: 'bad' });
  });

  it('marks a decrease bad when higher is better and good when lower is better', () => {
    expect(computeDelta(3, 8, 'higher-better')).toEqual({ text: '-5', direction: 'down', tone: 'bad' });
    expect(computeDelta(3, 8, 'lower-better')).toEqual({ text: '-5', direction: 'down', tone: 'good' });
  });

  it('keeps the tone neutral for neutral polarity, and formats the magnitude with the given formatter', () => {
    expect(computeDelta(90, 60, 'neutral', formatMinutes)).toEqual({ text: '+0h 30m', direction: 'up', tone: 'neutral' });
  });
});

describe('formatShortDate', () => {
  it('formats an ISO date or datetime from its string parts', () => {
    expect(formatShortDate('2026-09-12')).toBe('Sep 12');
    expect(formatShortDate('2026-09-01T23:30:00+00:00')).toBe('Sep 1');
    expect(formatShortDate('2026-12-31T00:00:00Z')).toBe('Dec 31');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-overview.utils.spec.ts"`
Expected: FAIL — the three helpers are not exported.

- [ ] **Step 3: Add the helpers**

Append to `employee-overview.utils.ts`:

```ts
/** '83h 20m' style duration from whole minutes (negatives clamp to 0). */
export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`;
}

export type DeltaPolarity = 'higher-better' | 'lower-better' | 'neutral';

export interface Delta {
  readonly text: string;
  readonly direction: 'up' | 'down' | 'flat';
  readonly tone: 'good' | 'bad' | 'neutral';
}

/** Difference of a metric against the previous period, with a tone that respects which direction is good. */
export function computeDelta(
  current: number,
  previous: number,
  polarity: DeltaPolarity,
  format: (n: number) => string = String
): Delta {
  const diff = current - previous;
  if (diff === 0) return { text: 'No change', direction: 'flat', tone: 'neutral' };

  const improved = polarity === 'higher-better' ? diff > 0 : polarity === 'lower-better' ? diff < 0 : null;
  return {
    text: `${diff > 0 ? '+' : '-'}${format(Math.abs(diff))}`,
    direction: diff > 0 ? 'up' : 'down',
    tone: improved === null ? 'neutral' : improved ? 'good' : 'bad'
  };
}

/** 'Sep 12' from an ISO date or datetime, using its leading YYYY-MM-DD parts (UTC date). */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}
```

- [ ] **Step 4: Run to verify the utils pass**

Run: same command as Step 2. Expected: PASS (existing utils tests plus the new ones).

- [ ] **Step 5: Write the failing store, picker and badge tests**

`employee-period.store.compare.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore compare', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    return TestBed.inject(EmployeePeriodStore);
  }

  it('starts with comparison off', () => {
    const store = setup();

    expect(store.compare()).toBe('none');
    expect(store.comparePrevious()).toBe(false);
  });

  it('turns comparison on and off, independent of the month', () => {
    const store = setup();
    store.setMonth('2026-05');

    store.setCompare('previous');
    expect(store.comparePrevious()).toBe(true);
    expect(store.month()).toBe('2026-05');

    store.setCompare('none');
    expect(store.comparePrevious()).toBe(false);
  });
});
```

`employee-compare-picker.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from './employee-compare-picker.component';

describe('EmployeeComparePickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeeComparePickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    const fixture = TestBed.createComponent(EmployeeComparePickerComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('offers no comparison and previous period', () => {
    const { fixture } = setup();

    expect(fixture.componentInstance.options.map((o) => o.value)).toEqual(['none', 'previous']);
    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the choice to the store', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('previous');
    expect(store.comparePrevious()).toBe(true);

    fixture.componentInstance.onChange('none');
    expect(store.comparePrevious()).toBe(false);
  });

  it('ignores values it does not know', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('last-year');

    expect(store.compare()).toBe('none');
  });
});
```

`delta-badge.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Delta } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from './delta-badge.component';

describe('DeltaBadgeComponent', () => {
  function render(delta: Delta | null) {
    TestBed.configureTestingModule({ imports: [DeltaBadgeComponent] });
    const fixture = TestBed.createComponent(DeltaBadgeComponent);
    fixture.componentRef.setInput('delta', delta);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const badge = (el: HTMLElement) => el.querySelector('[data-testid="delta"]') as HTMLElement | null;

  it('renders nothing without a delta', () => {
    expect(badge(render(null))).toBeNull();
  });

  it('shows an up arrow, the text and the tone class', () => {
    const el = badge(render({ text: '+2', direction: 'up', tone: 'good' }))!;

    expect(el.textContent).toContain('▲');
    expect(el.textContent).toContain('+2');
    expect(el.classList.contains('delta--good')).toBe(true);
  });

  it('shows a down arrow for a decrease and a dash when flat', () => {
    expect(badge(render({ text: '-3', direction: 'down', tone: 'bad' }))!.textContent).toContain('▼');

    TestBed.resetTestingModule();
    const flat = badge(render({ text: 'No change', direction: 'flat', tone: 'neutral' }))!;
    expect(flat.textContent).toContain('–');
    expect(flat.classList.contains('delta--neutral')).toBe(true);
  });

  it('exposes a readable label for assistive technology', () => {
    const el = badge(render({ text: '+2', direction: 'up', tone: 'bad' }))!;

    expect(el.getAttribute('aria-label')).toBe('Up +2 versus the previous period');
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/state/employee-period.store.compare.spec.ts" --include "src/app/modules/people/ui/employee-compare-picker/*.spec.ts" --include "src/app/modules/people/ui/delta-badge/*.spec.ts"`
Expected: FAIL — `compare`/`comparePrevious`/`setCompare` missing; the two components do not exist.

- [ ] **Step 7: Rewrite the store, write the picker and the badge**

Replace `employee-period.store.ts` with:

```ts
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
```

`ui/employee-compare-picker/employee-compare-picker.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeeCompareMode, EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-employee-compare-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Compare with"
      [options]="options"
      [value]="store.compare()"
      (valueChange)="onChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeComparePickerComponent {
  protected readonly store = inject(EmployeePeriodStore);

  readonly options: readonly SelectOption[] = [
    { value: 'none', label: 'No comparison' },
    { value: 'previous', label: 'Compare to previous period' }
  ];

  onChange(value: string): void {
    if (value === 'none' || value === 'previous') {
      this.store.setCompare(value as EmployeeCompareMode);
    }
  }
}
```

`ui/delta-badge/delta-badge.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Delta } from '../../utils/employee-overview.utils';

/** Small "▲ +2" chip showing a change against the previous period; renders nothing for null. */
@Component({
  selector: 'app-delta-badge',
  standalone: true,
  template: `
    @if (delta(); as d) {
      <span
        data-testid="delta"
        class="delta"
        [class]="'delta--' + d.tone"
        [attr.aria-label]="label()"
      >{{ arrow() }} {{ d.text }}</span>
    }
  `,
  styles: [`
    .delta { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; }
    .delta--good { color: #16a34a; }
    .delta--bad { color: var(--color-danger-text); }
    .delta--neutral { color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeltaBadgeComponent {
  readonly delta = input<Delta | null>(null);

  readonly arrow = computed(() => {
    const d = this.delta();
    return d?.direction === 'up' ? '▲' : d?.direction === 'down' ? '▼' : '–';
  });

  readonly label = computed(() => {
    const d = this.delta();
    if (!d) return null;
    const word = d.direction === 'up' ? 'Up' : d.direction === 'down' ? 'Down' : 'No change';
    return d.direction === 'flat' ? 'No change versus the previous period' : `${word} ${d.text} versus the previous period`;
  });
}
```

- [ ] **Step 8: Run to verify they pass, then the whole people module**

Run: `npx ng test --watch=false --include "src/app/modules/people/state/*.spec.ts" --include "src/app/modules/people/ui/employee-compare-picker/*.spec.ts" --include "src/app/modules/people/ui/delta-badge/*.spec.ts" --include "src/app/modules/people/utils/employee-overview.utils.spec.ts"`
Expected: all pass (including Plan 2's existing `employee-period.store.spec.ts`, which must not regress).

- [ ] **Step 9: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/utils/employee-overview.utils.ts src/app/modules/people/utils/employee-overview.utils.spec.ts src/app/modules/people/state/employee-period.store.ts src/app/modules/people/state/employee-period.store.compare.spec.ts src/app/modules/people/ui/employee-compare-picker src/app/modules/people/ui/delta-badge
git commit -m "feat(people): add compare setting, delta helpers and delta badge for overview

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Work Management and Delivery widgets

**Files:**
- Create: `src/app/modules/people/ui/overview-work-widget/overview-work-widget.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/overview-delivery-widget/overview-delivery-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `createWidgetLoader`, `WidgetCardComponent`, `EmployeePeriodStore` (`from`, `to`, `comparePrevious`), `PeopleApiService.getOverviewWork/getOverviewDelivery` (Task 1), `computeDelta`, `DeltaBadgeComponent` (Task 2).
- Produces: `<app-overview-work-widget [employeeId]>` and `<app-overview-delivery-widget [employeeId]>` (required `employeeId: string`; both refetch on month change; Delivery also on compare change and passes `comparePrevious` as the API's 4th argument).

- [ ] **Step 1: Write the failing work widget test**

`overview-work-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewWorkWidgetComponent } from './overview-work-widget.component';

describe('OverviewWorkWidgetComponent', () => {
  const response: EmployeeWorkOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    assigned: 24,
    completed: 18,
    inProgress: 5,
    overdue: 1,
    notStarted: 0,
    completionRatePercent: 75,
    onTimeRatePercent: 89
  };

  function setup(getOverviewWork: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewWorkWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewWork } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewWorkWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!;

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows assigned, completed, in progress and overdue counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'work-assigned')).toContain('24');
    expect(text(el, 'work-completed')).toContain('18');
    expect(text(el, 'work-in-progress')).toContain('5');
    expect(text(el, 'work-overdue')).toContain('1');
  });

  it('draws a progress bar whose segments are proportional to the counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const width = (id: string) => (el.querySelector(`[data-testid="${id}"]`) as HTMLElement).style.width;

    expect(width('seg-completed')).toBe('75%');
    expect(parseFloat(width('seg-in-progress'))).toBeCloseTo(20.83, 1);
    expect(parseFloat(width('seg-overdue'))).toBeCloseTo(4.17, 1);
  });

  it('shows the completion and on-time rates, and a dash when the on-time rate is unknown', () => {
    const known = setup(vi.fn().mockReturnValue(of(response)));
    expect(text(known.el, 'work-completion-rate')).toContain('75%');
    expect(text(known.el, 'work-ontime-rate')).toContain('89%');

    TestBed.resetTestingModule();
    const unknown = setup(vi.fn().mockReturnValue(of({ ...response, onTimeRatePercent: null })));
    expect(text(unknown.el, 'work-ontime-rate')).toContain('—');
  });

  it('shows the empty state when no tasks belong to the period', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, assigned: 0, completed: 0, inProgress: 0, overdue: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
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

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-work-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the work widget**

`overview-work-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-overview-work-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Management"
      [state]="loader.state()"
      errorMessage="Could not load work management."
      emptyMessage="No tasks in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-assigned">{{ d.assigned }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Assigned</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-completed">{{ d.completed }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Completed</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold text-[var(--color-text-primary)]" data-testid="work-in-progress">{{ d.inProgress }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">In progress</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.overdue > 0" [class.text-[var(--color-text-primary)]]="d.overdue === 0" data-testid="work-overdue">{{ d.overdue }}</dd>
            <dt class="text-xs text-[var(--color-text-secondary)]">Overdue</dt>
          </div>
        </dl>

        <div class="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]" role="img" [attr.aria-label]="barLabel(d)">
          <span class="seg seg--completed" data-testid="seg-completed" [style.width.%]="share(d.completed, d)"></span>
          <span class="seg seg--in-progress" data-testid="seg-in-progress" [style.width.%]="share(d.inProgress, d)"></span>
          <span class="seg seg--overdue" data-testid="seg-overdue" [style.width.%]="share(d.overdue, d)"></span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-3 text-sm">
          <div>
            <p class="text-xs text-[var(--color-text-secondary)]">Completion rate</p>
            <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="work-completion-rate">{{ d.completionRatePercent }}%</p>
          </div>
          <div>
            <p class="text-xs text-[var(--color-text-secondary)]">On-time rate</p>
            <p class="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="work-ontime-rate">{{ d.onTimeRatePercent === null ? '—' : d.onTimeRatePercent + '%' }}</p>
          </div>
        </div>
      }
    </app-widget-card>
  `,
  styles: [`
    .seg { height: 100%; display: block; }
    .seg--completed { background: #16a34a; }
    .seg--in-progress { background: #3b82f6; }
    .seg--overdue { background: #dc2626; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewWorkWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.assigned === 0 }
  );

  share(count: number, d: EmployeeWorkOverviewResponse): number {
    return d.assigned === 0 ? 0 : (count / d.assigned) * 100;
  }

  barLabel(d: EmployeeWorkOverviewResponse): string {
    return `${d.completed} completed, ${d.inProgress} in progress, ${d.overdue} overdue of ${d.assigned} assigned`;
  }
}
```

- [ ] **Step 4: Run to verify the work widget passes**

Run: same command as Step 2. Expected: 7 passed.

- [ ] **Step 5: Write the failing delivery widget test**

`overview-delivery-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDeliveryResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDeliveryWidgetComponent } from './overview-delivery-widget.component';

describe('OverviewDeliveryWidgetComponent', () => {
  const response: EmployeeDeliveryResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    tasksAssigned: 21,
    tasksCompleted: 18,
    onTimeCompleted: 16,
    completedWithDueDate: 18,
    storyPointsAssigned: 42,
    storyPointsCompleted: 34,
    previous: null
  };

  function setup(getOverviewDelivery: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewDeliveryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewDelivery } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDeliveryWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!;

  it('requests the month with comparison off by default', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
  });

  it('shows tasks completed, on-time completion and story points as x / y', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'delivery-tasks')).toContain('18 / 21');
    expect(text(el, 'delivery-ontime')).toContain('16 / 18');
    expect(text(el, 'delivery-points')).toContain('34 / 42');
  });

  it('shows no deltas without previous data', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
  });

  it('shows deltas for tasks and story points when previous data exists', () => {
    const previous = { ...response, tasksCompleted: 15, storyPointsCompleted: 40, previous: null };
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, previous })));

    const tasksDelta = el.querySelector('[data-testid="delivery-tasks-delta"] [data-testid="delta"]')!;
    expect(tasksDelta.textContent).toContain('+3');
    expect(tasksDelta.classList.contains('delta--good')).toBe(true);
    const pointsDelta = el.querySelector('[data-testid="delivery-points-delta"] [data-testid="delta"]')!;
    expect(pointsDelta.textContent).toContain('-6');
    expect(pointsDelta.classList.contains('delta--bad')).toBe(true);
  });

  it('asks the API for the previous period once comparison is switched on', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setCompare('previous');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-01', '2026-09-30', true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', false);
  });

  it('shows the empty state when there are no tasks', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-delivery-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 7: Write the delivery widget**

`overview-delivery-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDeliveryResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { Delta, computeDelta } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-overview-delivery-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Delivery"
      [state]="loader.state()"
      errorMessage="Could not load delivery."
      emptyMessage="No tasks in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Tasks completed</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="delivery-tasks">{{ d.tasksCompleted }} / {{ d.tasksAssigned }}</span>
              <span data-testid="delivery-tasks-delta"><app-delta-badge [delta]="tasksDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">On-time completion</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]" data-testid="delivery-ontime">{{ d.onTimeCompleted }} / {{ d.completedWithDueDate }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Story points</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="delivery-points">{{ d.storyPointsCompleted }} / {{ d.storyPointsAssigned }}</span>
              <span data-testid="delivery-points-delta"><app-delta-badge [delta]="pointsDelta(d)" /></span>
            </dd>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDeliveryWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), this.period.comparePrevious()),
    { isEmpty: (v) => v.tasksAssigned === 0 }
  );

  tasksDelta(d: EmployeeDeliveryResponse): Delta | null {
    return d.previous ? computeDelta(d.tasksCompleted, d.previous.tasksCompleted, 'higher-better') : null;
  }

  pointsDelta(d: EmployeeDeliveryResponse): Delta | null {
    return d.previous ? computeDelta(d.storyPointsCompleted, d.previous.storyPointsCompleted, 'higher-better') : null;
  }
}
```

- [ ] **Step 8: Run to verify both widgets pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-work-widget/*.spec.ts" --include "src/app/modules/people/ui/overview-delivery-widget/*.spec.ts"`
Expected: 7 + 8 passed.

- [ ] **Step 9: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-work-widget src/app/modules/people/ui/overview-delivery-widget
git commit -m "feat(people): add overview work management and delivery widgets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- Work Management card (assigned/completed/in progress/overdue, proportional bar, completion + on-time rates) and Delivery (tasks, on-time, story points, deltas vs previous): Task 3. Foundations (models, API, compare, deltas): Tasks 1-2.
- Type consistency: API signatures (T1) match the widget calls and specs (`getOverviewDelivery(id, from, to, comparePrevious)` → 4 args always; `getOverviewWork(id, from, to)` → 3); `EmployeePeriodStore.comparePrevious`/`setCompare` (T2) used by T3; `computeDelta`/`Delta`/`DeltaBadgeComponent` (T2) used by the Delivery widget; response field names mirror the backend records (camelCase) exactly.
- Verified by reading source: `app-select` API; Plan 2's store/widgets/loader shape; committed Plan 2 model layout (the discipline `locationViolations` line is the anchor for Step 3). Not compile-checked or run: the executor's first test run is the first compile. Fix compile errors by aligning to real signatures, never by weakening a test.
- Known limits: story-points delta compares completed points only; "on-time completion" shows a fraction, not a delta; the Work card has no comparison (a comparison there was not requested).
- Continues in Plan 3B frontend (activity widget, discipline deltas, approvals widget, Overview tab layout, spec stub updates, live check).
