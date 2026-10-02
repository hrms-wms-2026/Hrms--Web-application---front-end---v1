# Employee Detail — Work & Activity Tab (frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Work & Activity** tab to the employee detail page. It has seven cards, all fed by real backend endpoints, with no mock data anywhere.

**Architecture:**
- The tab follows the existing Overview tab exactly. It provides its own `EmployeePeriodStore` and shows `EmployeePeriodPickerComponent`.
- Every card is a `ui/` component that wraps `WidgetCardComponent` and loads through `createWidgetLoader`, so each card loads, fails and retries on its own.
- A backend `403` shows the card's "no access" state.
- A monitoring toggle that is off shows the card's empty state with a message saying so.
- Charts are CSS bars. The spec allows no chart library.

**Tech Stack:** Angular 21 standalone components, signals, `@ngrx/signals`, Vitest (`npm run test`), Tailwind utility classes with the app's CSS variables.

**Design source:** the Work & Activity mockup (product owner, 2026-09-30). Spec: `../../specs/…/2026-09-30-employee-detail-redesign-design.md`.

## Prerequisites (backend, `HRMS-Backend-v1/docs/superpowers/plans/`)

| Card | Endpoint(s) | Backend plan |
|---|---|---|
| Work summary | `GET /employees/{id}/overview/work?from&to` | 3A `2026-09-30-employee-overview-work-delivery-backend.md` |
| Delivery health | `overview/delivery?from&to` + `work-activity/delivery-trend?to` | 3A + 4A |
| Needs attention | `work-activity/needs-attention` | 4A `next/2026-09-30-employee-work-activity-tasks-backend.md` |
| Recent tasks | `work-activity/recent-tasks` | 4A |
| Recorded activity | `overview/activity?from&to` + `work-activity/activity-by-hour?from&to` | 3B + 4B `next/2026-09-30-employee-work-activity-monitoring-backend.md` |
| Application usage | `work-activity/app-usage?from&to` | 4B |
| Work pattern | `work-activity/work-pattern?from&to` | 4B |

The frontend can be built before the backend ships, because every spec stubs `PeopleApiService`. Until an endpoint exists, its card shows the error state in a real browser, never invented numbers.

## Global Constraints

- **Branch:** branch `feature/employee-work-activity-tab` from `origin/Development`, in a clean checkout or worktree. Development already has everything this plan builds on:
  - the 3-tab `DetailTab` in `employee-detail.component.ts`
  - `overview-tab.component.ts`
  - `shared/ui/widget-card/widget-loader.ts`
  - `state/employee-period.store.ts`
  - `ui/employee-period-picker/`

  Don't work in `C:\HR2\Hrms--Web-application---front-end---v1` as it is: it is on `feature/flow09-exception-alerts` with the user's own staged employee-detail changes. Before each commit, run `git branch --show-current` and `git status --short`, and stage only the task's files.
- **No mock data.** No `*.mock.ts`, no `of(fakeData)` in services, and no "development only" fallbacks. `employee-insights.mock.ts` stays deleted.
- **Period:** month-only, through `EmployeePeriodStore` (`from`/`to` = month bounds). Week and custom ranges are out of scope because the picker supports months only. Needs attention and Recent tasks ignore the month; they are "now" cards.
- **Tests:** `npx ng test --include='src/app/modules/people/**'` (Vitest). Specs sit next to their files, with `PeopleApiService` stubbed via `{ provide: PeopleApiService, useValue: {...} }`, as in `overview-discipline-widget.component.spec.ts`.
- **Task links:** there is no task-detail route. Link to `['/work', projectId, 'board']` with `queryParams: { highlightTaskId }`, the same deep link as `dashboard/feature/my-tasks-card`.
- **Copy:** sentence case and no "please". Durations as `2h 30m` / `12m`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure (all under `src/app/modules/people/`)

| File | Responsibility |
|---|---|
| `models/employee-work-activity.model.ts` (create) | DTOs mirroring the 3A/3B/4A/4B backend records |
| `data-access/people-api.service.ts` (+ spec) (modify) | 9 GET methods |
| `utils/work-activity.utils.ts` (+ spec) (create) | `formatMinutes`, `formatClock`, `percent`, `visibleHours`, `attentionLabel` |
| `ui/work-activity-bar-chart/work-activity-bar-chart.component.ts` (+ spec) (create) | CSS bar chart (label + value per bar) |
| `ui/work-summary-widget/…` (create) | Assigned / Completed / In progress / Overdue |
| `ui/needs-attention-widget/…` (create) | Overdue + due-soon table |
| `ui/delivery-health-widget/…` (create) | Completion %, on-time %, tasks, story points, 6-month chart |
| `ui/recorded-activity-widget/…` (create) | Active / Idle / Meeting / Last activity + hourly chart |
| `ui/recent-tasks-widget/…` (create) | Latest 5 tasks table |
| `ui/app-usage-widget/…` (create) | Top 5 apps table |
| `ui/work-pattern-widget/…` (create) | Focus blocks, top app, longest idle |
| `feature/employee-detail/work-activity-tab.component.ts` (+ spec) (create) | Layout + period picker |
| `feature/employee-detail/employee-detail.component.ts` (+ spec) (modify) | Add the tab |

---

### Task 1: Models and API methods

**Files:**
- Create: `src/app/modules/people/models/employee-work-activity.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts`

- [ ] **Step 1: Write the failing tests** (append inside the existing `describe` in `people-api.service.spec.ts`, which already sets up `HttpTestingController` as `http` and the service as `service`; match the local variable names used there)

```ts
  describe('work & activity endpoints', () => {
    const base = `${environment.apiUrl}/employees/emp-1`;

    it.each([
      ['getOverviewWork', `${base}/overview/work?from=2026-09-01&to=2026-09-30`],
      ['getOverviewDelivery', `${base}/overview/delivery?from=2026-09-01&to=2026-09-30`],
      ['getOverviewActivity', `${base}/overview/activity?from=2026-09-01&to=2026-09-30`],
      ['getWorkActivityByHour', `${base}/work-activity/activity-by-hour?from=2026-09-01&to=2026-09-30`],
      ['getWorkActivityAppUsage', `${base}/work-activity/app-usage?from=2026-09-01&to=2026-09-30`],
      ['getWorkActivityWorkPattern', `${base}/work-activity/work-pattern?from=2026-09-01&to=2026-09-30`]
    ] as const)('%s sends the month as from/to', (method, url) => {
      const call = service[method].bind(service) as (id: string, from: string, to: string) => Observable<unknown>;
      call('emp-1', '2026-09-01', '2026-09-30').subscribe();

      const req = http.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('getWorkActivityNeedsAttention and getWorkActivityRecentTasks take no period', () => {
      service.getWorkActivityNeedsAttention('emp-1').subscribe();
      service.getWorkActivityRecentTasks('emp-1').subscribe();

      http.expectOne(`${base}/work-activity/needs-attention`).flush({ asOf: '2026-09-15', totalCount: 0, items: [] });
      http.expectOne(`${base}/work-activity/recent-tasks`).flush({ items: [] });
    });

    it('getWorkActivityDeliveryTrend sends to', () => {
      service.getWorkActivityDeliveryTrend('emp-1', '2026-09-30').subscribe();

      http.expectOne(`${base}/work-activity/delivery-trend?to=2026-09-30`).flush({ months: [] });
    });
  });
```

(Add `import { Observable } from 'rxjs';` to the spec if it isn't already imported.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include='src/app/modules/people/data-access/people-api.service.spec.ts'`
Expected: FAIL with "service.getOverviewWork is not a function".

- [ ] **Step 3: Create the models**

`models/employee-work-activity.model.ts`:

```ts
/** Mirrors HRMS-Backend-v1 EmployeeWorkOverviewResponse (Plan 3A, GET /employees/{id}/overview/work). */
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

/** Mirrors EmployeeDeliveryResponse (Plan 3A, overview/delivery). */
export interface EmployeeDeliveryResponse extends EmployeeDeliveryMetrics {
  readonly from: string;
  readonly to: string;
  readonly previous: EmployeeDeliveryMetrics | null;
}

/** Mirrors EmployeeActivityOverviewResponse (Plan 3B, overview/activity). */
export interface EmployeeActivityOverviewResponse {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly activeMinutes: number;
  readonly idleMinutes: number;
  readonly meetingMinutes: number;
  readonly daysWithData: number;
  readonly previous: unknown | null;
}

export type AttentionReason = 'overdue' | 'due_soon';

/** Mirrors EmployeeAttentionItem (Plan 4A). */
export interface EmployeeAttentionItem {
  readonly taskId: string;
  readonly shortId: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusName: string;
  readonly statusColor: string;
  readonly storyPoints: number | null;
  readonly dueDate: string;
  readonly reason: AttentionReason;
  readonly overdueDays: number | null;
  readonly daysUntilDue: number | null;
}

export interface EmployeeNeedsAttentionResponse {
  readonly asOf: string;
  readonly totalCount: number;
  readonly items: readonly EmployeeAttentionItem[];
}

/** Mirrors EmployeeWorkTaskItem (Plan 4A). */
export interface EmployeeWorkTaskItem {
  readonly taskId: string;
  readonly shortId: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusName: string;
  readonly statusColor: string;
  readonly priority: string;
  readonly storyPoints: number | null;
  readonly dueDate: string | null;
  readonly progressPercent: number;
}

export interface EmployeeRecentTasksResponse {
  readonly items: readonly EmployeeWorkTaskItem[];
}

export interface EmployeeDeliveryTrendMonth {
  /** 'YYYY-MM' */
  readonly month: string;
  readonly completed: number;
}

export interface EmployeeDeliveryTrendResponse {
  readonly months: readonly EmployeeDeliveryTrendMonth[];
}

export interface ActivityHourBucket {
  readonly hour: number;
  readonly activeMinutes: number;
}

/** Mirrors EmployeeActivityByHourResponse (Plan 4B). */
export interface EmployeeActivityByHourResponse {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly timezone: string;
  readonly lastActivityAt: string | null;
  readonly hours: readonly ActivityHourBucket[];
}

export interface EmployeeAppUsageItem {
  readonly appName: string;
  readonly activeMinutes: number;
  readonly sessions: number;
  readonly lastUsedAt: string;
}

/** Mirrors EmployeeAppUsageResponse (Plan 4B). */
export interface EmployeeAppUsageResponse {
  readonly from: string;
  readonly to: string;
  readonly applicationTrackingEnabled: boolean;
  readonly totalMinutes: number;
  readonly apps: readonly EmployeeAppUsageItem[];
}

export interface EmployeeIdlePeriod {
  readonly start: string;
  readonly end: string;
  readonly minutes: number;
}

/** Mirrors EmployeeWorkPatternSummaryResponse (Plan 4B). */
export interface EmployeeWorkPatternSummaryResponse {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly focusBlocks: number;
  readonly topApp: string | null;
  readonly topAppMinutes: number;
  readonly longestIdle: EmployeeIdlePeriod | null;
}
```

- [ ] **Step 4: Add the service methods**

Add an `import { … } from '../models/employee-work-activity.model';` for every response type above. Add a private helper and the methods after `getOverviewTimeOff`:

```ts
  private periodParams(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }

  getOverviewWork(employeeId: string, from: string, to: string): Observable<EmployeeWorkOverviewResponse> {
    return this.http.get<EmployeeWorkOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/work`, { params: this.periodParams(from, to) });
  }

  getOverviewDelivery(employeeId: string, from: string, to: string): Observable<EmployeeDeliveryResponse> {
    return this.http.get<EmployeeDeliveryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/delivery`, { params: this.periodParams(from, to) });
  }

  getOverviewActivity(employeeId: string, from: string, to: string): Observable<EmployeeActivityOverviewResponse> {
    return this.http.get<EmployeeActivityOverviewResponse>(
      `${environment.apiUrl}/employees/${employeeId}/overview/activity`, { params: this.periodParams(from, to) });
  }

  getWorkActivityNeedsAttention(employeeId: string): Observable<EmployeeNeedsAttentionResponse> {
    return this.http.get<EmployeeNeedsAttentionResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/needs-attention`);
  }

  getWorkActivityRecentTasks(employeeId: string): Observable<EmployeeRecentTasksResponse> {
    return this.http.get<EmployeeRecentTasksResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/recent-tasks`);
  }

  getWorkActivityDeliveryTrend(employeeId: string, to: string): Observable<EmployeeDeliveryTrendResponse> {
    return this.http.get<EmployeeDeliveryTrendResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/delivery-trend`, { params: new HttpParams().set('to', to) });
  }

  getWorkActivityByHour(employeeId: string, from: string, to: string): Observable<EmployeeActivityByHourResponse> {
    return this.http.get<EmployeeActivityByHourResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/activity-by-hour`, { params: this.periodParams(from, to) });
  }

  getWorkActivityAppUsage(employeeId: string, from: string, to: string): Observable<EmployeeAppUsageResponse> {
    return this.http.get<EmployeeAppUsageResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/app-usage`, { params: this.periodParams(from, to) });
  }

  getWorkActivityWorkPattern(employeeId: string, from: string, to: string): Observable<EmployeeWorkPatternSummaryResponse> {
    return this.http.get<EmployeeWorkPatternSummaryResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-activity/work-pattern`, { params: this.periodParams(from, to) });
  }
```

Also add these routes to the service's header doc comment, which lists the backend controller/routes it targets.

- [ ] **Step 5: Run to verify it passes**

Run: `npx ng test --include='src/app/modules/people/data-access/people-api.service.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/models/employee-work-activity.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat(people): work & activity models and API methods

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Formatting utils

**Files:**
- Create: `src/app/modules/people/utils/work-activity.utils.ts`
- Test: `src/app/modules/people/utils/work-activity.utils.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { attentionLabel, formatClock, formatMinutes, percent, visibleHours } from './work-activity.utils';

describe('work-activity utils', () => {
  it('formatMinutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(12)).toBe('12m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(150)).toBe('2h 30m');
  });

  it('formatClock renders the time in the given zone', () => {
    expect(formatClock('2026-09-15T09:11:00Z', 'Asia/Colombo')).toMatch(/2:41\s?PM/);
    expect(formatClock(null)).toBe('—');
  });

  it('percent rounds and treats an empty whole as null', () => {
    expect(percent(18, 24)).toBe(75);
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBeNull();
  });

  it('visibleHours keeps at least 9..17 and widens to any hour with activity', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: hour === 7 || hour === 20 ? 5 : 0 }));
    const shown = visibleHours(hours);
    expect(shown[0].hour).toBe(7);
    expect(shown[shown.length - 1].hour).toBe(20);

    const quiet = visibleHours(Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: 0 })));
    expect(quiet.map((h) => h.hour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('attentionLabel', () => {
    expect(attentionLabel({ reason: 'overdue', overdueDays: 1, daysUntilDue: null })).toBe('1 day overdue');
    expect(attentionLabel({ reason: 'overdue', overdueDays: 3, daysUntilDue: null })).toBe('3 days overdue');
    expect(attentionLabel({ reason: 'due_soon', overdueDays: null, daysUntilDue: 0 })).toBe('Due today');
    expect(attentionLabel({ reason: 'due_soon', overdueDays: null, daysUntilDue: 2 })).toBe('Due in 2 days');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include='src/app/modules/people/utils/work-activity.utils.spec.ts'`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

```ts
import { ActivityHourBucket, EmployeeAttentionItem } from '../models/employee-work-activity.model';

/** 150 -> '2h 30m', 60 -> '1h', 12 -> '12m'. */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** '2:41 PM' in the viewer's zone (or the given one); '—' when there is no timestamp. */
export function formatClock(iso: string | null, timeZone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

/** Rounded percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** The chart always shows 9..17 and widens to include any hour that has activity. */
export function visibleHours(hours: readonly ActivityHourBucket[]): readonly ActivityHourBucket[] {
  const active = hours.filter((h) => h.activeMinutes > 0).map((h) => h.hour);
  const start = Math.min(9, ...active);
  const end = Math.max(17, ...active);
  return hours.filter((h) => h.hour >= start && h.hour <= end);
}

export function attentionLabel(item: Pick<EmployeeAttentionItem, 'reason' | 'overdueDays' | 'daysUntilDue'>): string {
  if (item.reason === 'overdue') {
    const d = item.overdueDays ?? 0;
    return `${d} ${d === 1 ? 'day' : 'days'} overdue`;
  }
  const d = item.daysUntilDue ?? 0;
  if (d === 0) return 'Due today';
  return `Due in ${d} ${d === 1 ? 'day' : 'days'}`;
}

/** '2026-09' -> 'Sep'. */
export function shortMonth(month: string): string {
  const index = Number(month.split('-')[1]) - 1;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index] ?? month;
}

/** 9 -> '9AM', 13 -> '1PM', 0 -> '12AM'. */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'AM' : 'PM'}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --include='src/app/modules/people/utils/work-activity.utils.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/utils/work-activity.utils.ts src/app/modules/people/utils/work-activity.utils.spec.ts
git commit -m "feat(people): work & activity formatting utils

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CSS bar chart

**Files:**
- Create: `src/app/modules/people/ui/work-activity-bar-chart/work-activity-bar-chart.component.ts`
- Test: `src/app/modules/people/ui/work-activity-bar-chart/work-activity-bar-chart.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { WorkActivityBarChartComponent } from './work-activity-bar-chart.component';

describe('WorkActivityBarChartComponent', () => {
  function render(bars: readonly { label: string; value: number }[]) {
    TestBed.configureTestingModule({ imports: [WorkActivityBarChartComponent] });
    const fixture = TestBed.createComponent(WorkActivityBarChartComponent);
    fixture.componentRef.setInput('bars', bars);
    fixture.componentRef.setInput('ariaLabel', 'Tasks completed per month');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws one bar per value, scaled to the largest', () => {
    const el = render([{ label: 'Aug', value: 5 }, { label: 'Sep', value: 10 }]);
    const bars = el.querySelectorAll<HTMLElement>('[data-testid="bar"]');

    expect(bars.length).toBe(2);
    expect(bars[0].style.height).toBe('50%');
    expect(bars[1].style.height).toBe('100%');
    expect(el.textContent).toContain('Aug');
  });

  it('draws flat bars when every value is zero', () => {
    const el = render([{ label: 'Aug', value: 0 }]);
    expect(el.querySelector<HTMLElement>('[data-testid="bar"]')!.style.height).toBe('0%');
  });

  it('exposes the values to assistive tech', () => {
    const el = render([{ label: 'Sep', value: 10 }]);
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('Sep: 10');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include='src/app/modules/people/ui/work-activity-bar-chart/**'`
Expected: FAIL, because the component is not found.

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarDatum {
  readonly label: string;
  readonly value: number;
}

/** Minimal CSS bar chart for the Work & Activity cards (the spec allows no chart library). */
@Component({
  selector: 'app-work-activity-bar-chart',
  standalone: true,
  template: `
    <div role="img" [attr.aria-label]="summary()" class="flex h-32 items-end gap-1.5">
      @for (bar of scaled(); track bar.label) {
        <div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div class="flex w-full flex-1 items-end">
            <div
              data-testid="bar"
              class="w-full rounded-t bg-[var(--color-accent)] opacity-80"
              [style.height]="bar.height"
              [attr.title]="bar.label + ': ' + bar.value"
            ></div>
          </div>
          <span class="truncate text-[11px] text-[var(--color-text-secondary)]">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkActivityBarChartComponent {
  readonly bars = input.required<readonly BarDatum[]>();
  readonly ariaLabel = input.required<string>();

  readonly scaled = computed(() => {
    const max = Math.max(0, ...this.bars().map((b) => b.value));
    return this.bars().map((b) => ({ ...b, height: `${max === 0 ? 0 : Math.round((b.value / max) * 100)}%` }));
  });

  readonly summary = computed(() => `${this.ariaLabel()}. ${this.bars().map((b) => `${b.label}: ${b.value}`).join(', ')}`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --include='src/app/modules/people/ui/work-activity-bar-chart/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/work-activity-bar-chart
git commit -m "feat(people): CSS bar chart for work & activity cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Task cards (Work summary, Needs attention, Delivery health, Recent tasks)

**Files** (each with a co-located `.spec.ts`):
- Create: `src/app/modules/people/ui/work-summary-widget/work-summary-widget.component.ts`
- Create: `src/app/modules/people/ui/needs-attention-widget/needs-attention-widget.component.ts`
- Create: `src/app/modules/people/ui/delivery-health-widget/delivery-health-widget.component.ts`
- Create: `src/app/modules/people/ui/recent-tasks-widget/recent-tasks-widget.component.ts`

- [ ] **Step 1: Write the failing specs**

`work-summary-widget.component.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { WorkSummaryWidgetComponent } from './work-summary-widget.component';

describe('WorkSummaryWidgetComponent', () => {
  const response = { from: '2026-09-01', to: '2026-09-30', assigned: 24, completed: 18, inProgress: 5, overdue: 1, notStarted: 0, completionRatePercent: 75, onTimeRatePercent: 89 };

  function setup(getOverviewWork: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [WorkSummaryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewWork } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(WorkSummaryWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const tile = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="work-${key}"]`)!.textContent!;

  it('requests the selected month and shows the four counts', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const el = setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    expect(tile(el, 'assigned')).toContain('24');
    expect(tile(el, 'completed')).toContain('18');
    expect(tile(el, 'in-progress')).toContain('5');
    expect(tile(el, 'overdue')).toContain('1');
  });

  it('shows the empty state when nothing is assigned in the month', () => {
    const el = setup(vi.fn().mockReturnValue(of({ ...response, assigned: 0, completed: 0, inProgress: 0, overdue: 0 })));
    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const el = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```


`needs-attention-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NeedsAttentionWidgetComponent } from './needs-attention-widget.component';

describe('NeedsAttentionWidgetComponent', () => {
  const item = {
    taskId: 't-1', shortId: 'WEB-1', title: 'Engine specification', projectId: 'p-1', projectName: 'Watercraft Platform',
    statusName: 'In Progress', statusColor: '#2563EB', storyPoints: 5, dueDate: '2026-09-13',
    reason: 'overdue' as const, overdueDays: 2, daysUntilDue: null
  };

  function setup(response: unknown) {
    const get = vi.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({
      imports: [NeedsAttentionWidgetComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: { getWorkActivityNeedsAttention: get } }]
    });
    const fixture = TestBed.createComponent(NeedsAttentionWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, get };
  }

  it('lists tasks with their issue, status, points and a board link', () => {
    const { el, get } = setup({ asOf: '2026-09-15', totalCount: 1, items: [item] });

    expect(get).toHaveBeenCalledWith('emp-1');
    const row = el.querySelector('[data-testid="attention-row"]')!;
    expect(row.textContent).toContain('Engine specification');
    expect(row.textContent).toContain('Watercraft Platform');
    expect(row.textContent).toContain('2 days overdue');
    expect(row.textContent).toContain('In Progress');
    const link = row.querySelector('a')!;
    expect(link.getAttribute('href')).toContain('/work/p-1/board');
    expect(link.getAttribute('href')).toContain('highlightTaskId=t-1');
  });

  it('shows how many more there are beyond the first five', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 8, items: [item] });
    expect(el.textContent).toContain('+7 more');
  });

  it('shows the empty state when nothing needs attention', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 0, items: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Nothing overdue or due in the next 3 days');
  });
});
```

`delivery-health-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { DeliveryHealthWidgetComponent } from './delivery-health-widget.component';

describe('DeliveryHealthWidgetComponent', () => {
  const delivery = {
    from: '2026-09-01', to: '2026-09-30', tasksAssigned: 21, tasksCompleted: 18, onTimeCompleted: 16, completedWithDueDate: 18,
    storyPointsAssigned: 42, storyPointsCompleted: 34, previous: null
  };
  const trend = { months: [{ month: '2026-08', completed: 22 }, { month: '2026-09', completed: 30 }] };

  function setup() {
    const api = {
      getOverviewDelivery: vi.fn().mockReturnValue(of(delivery)),
      getWorkActivityDeliveryTrend: vi.fn().mockReturnValue(of(trend))
    };
    TestBed.configureTestingModule({
      imports: [DeliveryHealthWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: api }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(DeliveryHealthWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, api };
  }

  const stat = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="delivery-${key}"]`)!.textContent!;

  it('shows completion, on-time, tasks and story points for the month', () => {
    const { el, api } = setup();

    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    expect(stat(el, 'completion')).toContain('86%');
    expect(stat(el, 'on-time')).toContain('89%');
    expect(stat(el, 'tasks')).toContain('18 / 21');
    expect(stat(el, 'points')).toContain('34 / 42');
  });

  it('draws the monthly trend ending at the selected month', () => {
    const { el, api } = setup();

    expect(api.getWorkActivityDeliveryTrend).toHaveBeenCalledWith('emp-1', '2026-09-30');
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(2);
    expect(el.textContent).toContain('Sep');
  });
});
```

`recent-tasks-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { RecentTasksWidgetComponent } from './recent-tasks-widget.component';

describe('RecentTasksWidgetComponent', () => {
  function setup(items: unknown[]) {
    TestBed.configureTestingModule({
      imports: [RecentTasksWidgetComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: { getWorkActivityRecentTasks: vi.fn().mockReturnValue(of({ items })) } }]
    });
    const fixture = TestBed.createComponent(RecentTasksWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows task, project, status, priority, due and points', () => {
    const el = setup([{
      taskId: 't-1', shortId: 'WEB-1', title: 'UI refinement', projectId: 'p-1', projectName: 'Design System',
      statusName: 'In Progress', statusColor: '#2563EB', priority: 'medium', storyPoints: 5, dueDate: '2026-09-16', progressPercent: 40
    }]);

    const row = el.querySelector('[data-testid="recent-row"]')!.textContent!;
    expect(row).toContain('UI refinement');
    expect(row).toContain('Design System');
    expect(row).toContain('In Progress');
    expect(row).toContain('Medium');
    expect(row).toContain('Sep 16');
    expect(row).toContain('5');
  });

  it('shows the empty state with no tasks', () => {
    expect(setup([]).querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --include='src/app/modules/people/ui/{work-summary,needs-attention,delivery-health,recent-tasks}-widget/**'`
Expected: FAIL, because the components are not found.

- [ ] **Step 3: Implement the four components**

`work-summary-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-work-summary-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work summary"
      [state]="loader.state()"
      emptyMessage="No tasks assigned in this month."
      errorMessage="Couldn't load the work summary."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div data-testid="work-assigned"><dt class="text-sm text-[var(--color-text-secondary)]">Assigned</dt><dd class="text-2xl font-semibold">{{ d.assigned }}</dd></div>
          <div data-testid="work-completed"><dt class="text-sm text-[var(--color-text-secondary)]">Completed</dt><dd class="text-2xl font-semibold">{{ d.completed }}</dd></div>
          <div data-testid="work-in-progress"><dt class="text-sm text-[var(--color-text-secondary)]">In progress</dt><dd class="text-2xl font-semibold">{{ d.inProgress }}</dd></div>
          <div data-testid="work-overdue">
            <dt class="text-sm text-[var(--color-text-secondary)]">Overdue</dt>
            <dd class="text-2xl font-semibold" [class.text-[var(--color-danger-text)]]="d.overdue > 0">{{ d.overdue }}</dd>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkSummaryWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => d.assigned === 0 }
  );
}
```

`needs-attention-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { attentionLabel } from '../../utils/work-activity.utils';

@Component({
  selector: 'app-needs-attention-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink],
  template: `
    <app-widget-card
      title="Needs attention"
      [state]="loader.state()"
      emptyMessage="Nothing overdue or due in the next 3 days."
      errorMessage="Couldn't load tasks that need attention."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr><th class="w-[30%] py-1 font-normal">Task</th><th class="py-1 font-normal">Project</th><th class="py-1 font-normal">Issue</th><th class="py-1 font-normal">Status</th><th class="w-10 py-1 font-normal">SP</th><th class="w-20 py-1"></th></tr>
          </thead>
          <tbody>
            @for (item of d.items; track item.taskId) {
              <tr data-testid="attention-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2" [title]="item.title">{{ item.title }}</td>
                <td class="truncate py-2">{{ item.projectName }}</td>
                <td class="py-2" [class.text-[var(--color-danger-text)]]="item.reason === 'overdue'" [class.text-[var(--color-warning-text)]]="item.reason === 'due_soon'">{{ label(item) }}</td>
                <td class="py-2"><span class="rounded-full border px-2 py-0.5 text-xs" [style.borderColor]="item.statusColor" [style.color]="item.statusColor">{{ item.statusName }}</span></td>
                <td class="py-2">{{ item.storyPoints ?? '—' }}</td>
                <td class="py-2 text-right">
                  <a class="text-[var(--color-accent)] underline" [routerLink]="['/work', item.projectId, 'board']" [queryParams]="{ highlightTaskId: item.taskId }">View task</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (d.totalCount > d.items.length) {
          <p class="mt-2 text-sm text-[var(--color-text-secondary)]">+{{ d.totalCount - d.items.length }} more</p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NeedsAttentionWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityNeedsAttention(this.employeeId()),
    { isEmpty: (d) => d.items.length === 0 }
  );

  readonly label = attentionLabel;
}
```


`delivery-health-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { percent, shortMonth } from '../../utils/work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

@Component({
  selector: 'app-delivery-health-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Delivery health"
      [state]="delivery.state()"
      emptyMessage="No tasks assigned in this month."
      errorMessage="Couldn't load delivery health."
      (retry)="delivery.reload(); trend.reload()"
    >
      @if (delivery.data(); as d) {
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div data-testid="delivery-completion"><dt class="text-xs text-[var(--color-text-secondary)]">Completion rate</dt><dd class="text-xl font-semibold text-[var(--color-success)]">{{ pct(d.tasksCompleted, d.tasksAssigned) }}</dd></div>
          <div data-testid="delivery-on-time"><dt class="text-xs text-[var(--color-text-secondary)]">On-time completion</dt><dd class="text-xl font-semibold">{{ pct(d.onTimeCompleted, d.completedWithDueDate) }}</dd></div>
          <div data-testid="delivery-tasks"><dt class="text-xs text-[var(--color-text-secondary)]">Tasks completed</dt><dd class="text-xl font-semibold">{{ d.tasksCompleted }} / {{ d.tasksAssigned }}</dd></div>
          <div data-testid="delivery-points"><dt class="text-xs text-[var(--color-text-secondary)]">Story points completed</dt><dd class="text-xl font-semibold">{{ d.storyPointsCompleted }} / {{ d.storyPointsAssigned }}</dd></div>
        </dl>
        <p class="mb-1 mt-4 text-xs text-[var(--color-text-secondary)]">Tasks completed (monthly)</p>
        @if (bars(); as b) {
          <app-work-activity-bar-chart [bars]="b" ariaLabel="Tasks completed per month" />
        } @else if (trend.state() === 'error') {
          <p class="text-sm text-[var(--color-text-secondary)]">Couldn't load the monthly trend.</p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeliveryHealthWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly delivery = createWidgetLoader(
    () => this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => d.tasksAssigned === 0 }
  );

  readonly trend = createWidgetLoader(() => this.api.getWorkActivityDeliveryTrend(this.employeeId(), this.period.to()));

  readonly bars = computed(() => this.trend.data()?.months.map((m) => ({ label: shortMonth(m.month), value: m.completed })) ?? null);

  pct(part: number, whole: number): string {
    const value = percent(part, whole);
    return value === null ? '—' : `${value}%`;
  }
}
```

`recent-tasks-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';

@Component({
  selector: 'app-recent-tasks-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink],
  template: `
    <app-widget-card
      title="Recent tasks"
      [state]="loader.state()"
      emptyMessage="No tasks assigned yet."
      errorMessage="Couldn't load recent tasks."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr><th class="w-[30%] py-1 font-normal">Task</th><th class="py-1 font-normal">Project</th><th class="py-1 font-normal">Status</th><th class="py-1 font-normal">Priority</th><th class="py-1 font-normal">Due</th><th class="w-10 py-1 font-normal">SP</th></tr>
          </thead>
          <tbody>
            @for (t of d.items; track t.taskId) {
              <tr data-testid="recent-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2"><a [routerLink]="['/work', t.projectId, 'board']" [queryParams]="{ highlightTaskId: t.taskId }" [title]="t.title">{{ t.title }}</a></td>
                <td class="truncate py-2">{{ t.projectName }}</td>
                <td class="py-2"><span class="rounded-full border px-2 py-0.5 text-xs" [style.borderColor]="t.statusColor" [style.color]="t.statusColor">{{ t.statusName }}</span></td>
                <td class="py-2">{{ priorityLabel(t.priority) }}</td>
                <td class="py-2">{{ dueLabel(t.dueDate) }}</td>
                <td class="py-2">{{ t.storyPoints ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentTasksWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityRecentTasks(this.employeeId()),
    { isEmpty: (d) => d.items.length === 0 }
  );

  priorityLabel(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  dueLabel(dueDate: string | null): string {
    if (!dueDate) return '—';
    const date = new Date(`${dueDate}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? dueDate
      : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx ng test --include='src/app/modules/people/ui/{work-summary,needs-attention,delivery-health,recent-tasks}-widget/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/work-summary-widget src/app/modules/people/ui/needs-attention-widget src/app/modules/people/ui/delivery-health-widget src/app/modules/people/ui/recent-tasks-widget
git commit -m "feat(people): work & activity task cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Agent cards (Recorded activity, Application usage, Work pattern)

**Files** (each with a co-located `.spec.ts`):
- Create: `src/app/modules/people/ui/recorded-activity-widget/recorded-activity-widget.component.ts`
- Create: `src/app/modules/people/ui/app-usage-widget/app-usage-widget.component.ts`
- Create: `src/app/modules/people/ui/work-pattern-widget/work-pattern-widget.component.ts`

- [ ] **Step 1: Write the failing specs**

`recorded-activity-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { RecordedActivityWidgetComponent } from './recorded-activity-widget.component';

describe('RecordedActivityWidgetComponent', () => {
  const totals = { from: '2026-09-01', to: '2026-09-30', activityMonitoringEnabled: true, activeMinutes: 150, idleMinutes: 12, meetingMinutes: 65, daysWithData: 3, previous: null };
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: hour === 10 ? 40 : 0 }));
  const byHour = { from: '2026-09-01', to: '2026-09-30', activityMonitoringEnabled: true, timezone: 'UTC', lastActivityAt: '2026-09-15T14:41:00Z', hours };

  function setup(t = totals, h = byHour) {
    const api = { getOverviewActivity: vi.fn().mockReturnValue(of(t)), getWorkActivityByHour: vi.fn().mockReturnValue(of(h)) };
    TestBed.configureTestingModule({
      imports: [RecordedActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: api }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(RecordedActivityWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, api };
  }

  const stat = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="activity-${key}"]`)!.textContent!;

  it('shows active, idle and meeting time for the month', () => {
    const { el, api } = setup();

    expect(api.getOverviewActivity).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    expect(stat(el, 'active')).toContain('2h 30m');
    expect(stat(el, 'idle')).toContain('12m');
    expect(stat(el, 'meeting')).toContain('1h 5m');
  });

  it('draws the hourly chart from 9AM to 5PM at least', () => {
    const { el } = setup();
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(9);
    expect(el.textContent).toContain('9AM');
  });

  it('says so when activity monitoring is off', () => {
    const { el } = setup({ ...totals, activityMonitoringEnabled: false }, { ...byHour, activityMonitoringEnabled: false, hours: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Activity monitoring is off for this employee');
  });
});
```

`app-usage-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { AppUsageWidgetComponent } from './app-usage-widget.component';

describe('AppUsageWidgetComponent', () => {
  function setup(response: unknown) {
    TestBed.configureTestingModule({
      imports: [AppUsageWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getWorkActivityAppUsage: vi.fn().mockReturnValue(of(response)) } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(AppUsageWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists apps with active time and sessions', () => {
    const el = setup({
      from: '2026-09-01', to: '2026-09-30', applicationTrackingEnabled: true, totalMinutes: 132,
      apps: [{ appName: 'Code.exe', activeMinutes: 132, sessions: 12, lastUsedAt: '2026-09-15T14:35:00Z' }]
    });

    const row = el.querySelector('[data-testid="app-row"]')!.textContent!;
    expect(row).toContain('Code.exe');
    expect(row).toContain('2h 12m');
    expect(row).toContain('12');
  });

  it('says so when application tracking is off', () => {
    const el = setup({ from: '2026-09-01', to: '2026-09-30', applicationTrackingEnabled: false, totalMinutes: 0, apps: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Application tracking is off for this employee');
  });
});
```

`work-pattern-widget.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { WorkPatternWidgetComponent } from './work-pattern-widget.component';

describe('WorkPatternWidgetComponent', () => {
  function setup(response: unknown) {
    TestBed.configureTestingModule({
      imports: [WorkPatternWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getWorkActivityWorkPattern: vi.fn().mockReturnValue(of(response)) } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(WorkPatternWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const base = { from: '2026-09-01', to: '2026-09-30', activityMonitoringEnabled: true };

  it('shows focus blocks, top app and longest idle', () => {
    const el = setup({ ...base, focusBlocks: 3, topApp: 'Code.exe', topAppMinutes: 72, longestIdle: { start: '2026-09-15T06:12:00Z', end: '2026-09-15T06:40:00Z', minutes: 28 } });

    expect(el.querySelector('[data-testid="pattern-focus"]')!.textContent).toContain('3');
    expect(el.querySelector('[data-testid="pattern-top-app"]')!.textContent).toContain('Code.exe');
    expect(el.querySelector('[data-testid="pattern-top-app"]')!.textContent).toContain('1h 12m');
    expect(el.querySelector('[data-testid="pattern-idle"]')!.textContent).toContain('28m');
  });

  it('shows a dash for the top app when application tracking is off', () => {
    const el = setup({ ...base, focusBlocks: 0, topApp: null, topAppMinutes: 0, longestIdle: null });
    expect(el.querySelector('[data-testid="pattern-top-app"]')!.textContent).toContain('—');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --include='src/app/modules/people/ui/{recorded-activity,app-usage,work-pattern}-widget/**'`
Expected: FAIL, because the components are not found.

- [ ] **Step 3: Implement the three components**

`recorded-activity-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, formatMinutes, hourLabel, visibleHours } from '../../utils/work-activity.utils';
import { WorkActivityBarChartComponent } from '../work-activity-bar-chart/work-activity-bar-chart.component';

@Component({
  selector: 'app-recorded-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent, WorkActivityBarChartComponent],
  template: `
    <app-widget-card
      title="Recorded activity"
      [state]="totals.state()"
      emptyMessage="Activity monitoring is off for this employee."
      errorMessage="Couldn't load recorded activity."
      (retry)="totals.reload(); byHour.reload()"
    >
      @if (totals.data(); as t) {
        <p class="mb-3 text-xs text-[var(--color-text-secondary)]">Based on device activity for the selected month</p>
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div data-testid="activity-active"><dt class="text-xs text-[var(--color-text-secondary)]">Active time</dt><dd class="text-lg font-semibold">{{ fmt(t.activeMinutes) }}</dd></div>
          <div data-testid="activity-idle"><dt class="text-xs text-[var(--color-text-secondary)]">Idle time</dt><dd class="text-lg font-semibold">{{ fmt(t.idleMinutes) }}</dd></div>
          <div data-testid="activity-meeting"><dt class="text-xs text-[var(--color-text-secondary)]">Meeting time</dt><dd class="text-lg font-semibold">{{ fmt(t.meetingMinutes) }}</dd></div>
          <div data-testid="activity-last"><dt class="text-xs text-[var(--color-text-secondary)]">Last activity</dt><dd class="text-lg font-semibold">{{ clock(byHour.data()?.lastActivityAt ?? null) }}</dd></div>
        </dl>
        <p class="mb-1 mt-4 text-xs text-[var(--color-text-secondary)]">Activity by time of day (minutes)</p>
        @if (bars(); as b) {
          <app-work-activity-bar-chart [bars]="b" ariaLabel="Active minutes by hour of day" />
        } @else if (byHour.state() === 'error') {
          <p class="text-sm text-[var(--color-text-secondary)]">Couldn't load activity by hour.</p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordedActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly totals = createWidgetLoader(
    () => this.api.getOverviewActivity(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => !d.activityMonitoringEnabled }
  );

  readonly byHour = createWidgetLoader(() => this.api.getWorkActivityByHour(this.employeeId(), this.period.from(), this.period.to()));

  readonly bars = computed(() => {
    const d = this.byHour.data();
    if (!d || !d.activityMonitoringEnabled) return null;
    return visibleHours(d.hours).map((h) => ({ label: hourLabel(h.hour), value: h.activeMinutes }));
  });

  readonly fmt = formatMinutes;
  clock(iso: string | null): string {
    return formatClock(iso);
  }
}
```

`app-usage-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAppUsageResponse } from '../../models/employee-work-activity.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, formatMinutes } from '../../utils/work-activity.utils';

@Component({
  selector: 'app-app-usage-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Application usage"
      [state]="loader.state()"
      [emptyMessage]="emptyMessage()"
      errorMessage="Couldn't load application usage."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr><th class="w-[35%] py-1 font-normal">Application</th><th class="py-1 font-normal">Active time</th><th class="py-1 font-normal">Sessions</th><th class="py-1 font-normal">Last used</th></tr>
          </thead>
          <tbody>
            @for (app of d.apps; track app.appName) {
              <tr data-testid="app-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2" [title]="app.appName">{{ app.appName }}</td>
                <td class="py-2">{{ fmt(app.activeMinutes) }}</td>
                <td class="py-2">{{ app.sessions }}</td>
                <td class="py-2">{{ clock(app.lastUsedAt) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppUsageWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityAppUsage(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d: EmployeeAppUsageResponse) => !d.applicationTrackingEnabled || d.apps.length === 0 }
  );

  // The empty state covers two cases; the loader keeps data on success, so the message can tell them apart.
  emptyMessage(): string {
    const d = this.loader.data();
    return d && !d.applicationTrackingEnabled
      ? 'Application tracking is off for this employee.'
      : 'No application usage recorded in this month.';
  }

  readonly fmt = formatMinutes;
  clock(iso: string): string {
    return formatClock(iso);
  }
}
```

`work-pattern-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatClock, formatMinutes } from '../../utils/work-activity.utils';

@Component({
  selector: 'app-work-pattern-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work pattern"
      [state]="loader.state()"
      emptyMessage="Activity monitoring is off for this employee."
      errorMessage="Couldn't load the work pattern."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div data-testid="pattern-focus">
            <dt class="text-xs text-[var(--color-text-secondary)]">Focused work blocks</dt>
            <dd class="text-lg font-semibold">{{ d.focusBlocks }}</dd>
            <dd class="text-xs text-[var(--color-text-secondary)]">(30 min or longer)</dd>
          </div>
          <div data-testid="pattern-top-app">
            <dt class="text-xs text-[var(--color-text-secondary)]">Top application</dt>
            <dd class="truncate text-lg font-semibold">{{ d.topApp ?? '—' }}</dd>
            @if (d.topApp) { <dd class="text-xs text-[var(--color-text-secondary)]">{{ fmt(d.topAppMinutes) }}</dd> }
          </div>
          <div data-testid="pattern-idle">
            <dt class="text-xs text-[var(--color-text-secondary)]">Longest idle period</dt>
            @if (d.longestIdle; as idle) {
              <dd class="text-lg font-semibold">{{ fmt(idle.minutes) }}</dd>
              <dd class="text-xs text-[var(--color-text-secondary)]">({{ clock(idle.start) }} – {{ clock(idle.end) }})</dd>
            } @else {
              <dd class="text-lg font-semibold">—</dd>
            }
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityWorkPattern(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => !d.activityMonitoringEnabled }
  );

  readonly fmt = formatMinutes;
  clock(iso: string): string {
    return formatClock(iso);
  }
}
```

> `createWidgetLoader` sets `data` before it sets `state` to `'empty'` (see `widget-loader.ts`), so `AppUsageWidgetComponent.emptyMessage()` can read `loader.data()` in the empty state.

- [ ] **Step 4: Run to verify they pass**

Run: `npx ng test --include='src/app/modules/people/ui/{recorded-activity,app-usage,work-pattern}-widget/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/recorded-activity-widget src/app/modules/people/ui/app-usage-widget src/app/modules/people/ui/work-pattern-widget
git commit -m "feat(people): work & activity agent cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The tab, wired into the employee detail page

**Files:**
- Create: `src/app/modules/people/feature/employee-detail/work-activity-tab.component.ts`
- Create: `src/app/modules/people/feature/employee-detail/work-activity-tab.component.spec.ts`
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts` (the `DetailTab` type at line 29, the `imports`, the template after the Overview block at line ~187, and the `tabs` array at line ~274)
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

- [ ] **Step 1: Write the failing tab spec**

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkActivityTabComponent } from './work-activity-tab.component';

describe('EmployeeWorkActivityTabComponent', () => {
  function setup() {
    const empty = { from: '2026-09-01', to: '2026-09-30' };
    const api = {
      getOverviewWork: vi.fn().mockReturnValue(of({ ...empty, assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })),
      getOverviewDelivery: vi.fn().mockReturnValue(of({ ...empty, tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })),
      getWorkActivityDeliveryTrend: vi.fn().mockReturnValue(of({ months: [] })),
      getWorkActivityNeedsAttention: vi.fn().mockReturnValue(of({ asOf: '2026-09-15', totalCount: 0, items: [] })),
      getWorkActivityRecentTasks: vi.fn().mockReturnValue(of({ items: [] })),
      getOverviewActivity: vi.fn().mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })),
      getWorkActivityByHour: vi.fn().mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, timezone: 'UTC', lastActivityAt: null, hours: [] })),
      getWorkActivityAppUsage: vi.fn().mockReturnValue(of({ ...empty, applicationTrackingEnabled: false, totalMinutes: 0, apps: [] })),
      getWorkActivityWorkPattern: vi.fn().mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, focusBlocks: 0, topApp: null, topAppMinutes: 0, longestIdle: null }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeWorkActivityTabComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(EmployeeWorkActivityTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the period picker and all seven cards', () => {
    const { el } = setup();

    for (const selector of [
      'app-employee-period-picker', 'app-work-summary-widget', 'app-needs-attention-widget', 'app-delivery-health-widget',
      'app-recorded-activity-widget', 'app-recent-tasks-widget', 'app-app-usage-widget', 'app-work-pattern-widget'
    ]) {
      expect(el.querySelector(selector), selector).toBeTruthy();
    }
  });

  it('changing the month reloads the period cards but not the "now" cards', () => {
    const { fixture, api } = setup();
    const picker = fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance;

    picker.onChange('2026-05');
    fixture.detectChanges();

    expect(api.getOverviewWork).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getWorkActivityAppUsage).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getWorkActivityNeedsAttention).toHaveBeenCalledTimes(1);
    expect(api.getWorkActivityRecentTasks).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --include='src/app/modules/people/feature/employee-detail/work-activity-tab.component.spec.ts'`
Expected: FAIL, because the component is not found.

- [ ] **Step 3: Implement the tab**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { AppUsageWidgetComponent } from '../../ui/app-usage-widget/app-usage-widget.component';
import { DeliveryHealthWidgetComponent } from '../../ui/delivery-health-widget/delivery-health-widget.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { NeedsAttentionWidgetComponent } from '../../ui/needs-attention-widget/needs-attention-widget.component';
import { RecentTasksWidgetComponent } from '../../ui/recent-tasks-widget/recent-tasks-widget.component';
import { RecordedActivityWidgetComponent } from '../../ui/recorded-activity-widget/recorded-activity-widget.component';
import { WorkPatternWidgetComponent } from '../../ui/work-pattern-widget/work-pattern-widget.component';
import { WorkSummaryWidgetComponent } from '../../ui/work-summary-widget/work-summary-widget.component';

/**
 * Work & Activity tab. Like the Overview tab it owns its own EmployeePeriodStore (the month resets
 * per employee page). Every card loads independently from its own endpoint; Needs attention and
 * Recent tasks are "now" cards and ignore the month.
 */
@Component({
  selector: 'app-employee-work-activity-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    WorkSummaryWidgetComponent,
    NeedsAttentionWidgetComponent,
    DeliveryHealthWidgetComponent,
    RecordedActivityWidgetComponent,
    RecentTasksWidgetComponent,
    AppUsageWidgetComponent,
    WorkPatternWidgetComponent
  ],
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Work and activity for the selected month</p>
      <app-employee-period-picker />
    </div>

    <app-work-summary-widget [employeeId]="employeeId()" />

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2"><app-needs-attention-widget [employeeId]="employeeId()" /></div>
      <app-delivery-health-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <app-recorded-activity-widget [employeeId]="employeeId()" />
      <app-recent-tasks-widget [employeeId]="employeeId()" />
      <div class="grid gap-4">
        <app-app-usage-widget [employeeId]="employeeId()" />
        <app-work-pattern-widget [employeeId]="employeeId()" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkActivityTabComponent {
  readonly employeeId = input.required<string>();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --include='src/app/modules/people/feature/employee-detail/work-activity-tab.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Write the failing shell test** (append to `employee-detail.component.spec.ts`, reusing its existing setup helper and the way its other tab tests click a tab; the helper and click code are already in that file)

```ts
  it('shows the Work & Activity tab between Employment and Personal and renders it when selected', async () => {
    const { fixture, el } = await setup(); // existing helper in this spec
    const labels = Array.from(el.querySelectorAll('nav button')).map((b) => b.textContent!.trim());
    expect(labels).toEqual(['Overview', 'Employment', 'Work & Activity', 'Personal']);

    (Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent!.includes('Work & Activity')) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('app-employee-work-activity-tab')).toBeTruthy();
  });
```

Adjust the `nav button` selector and the `setup()` call to whatever the existing tab tests in this spec use. Because the new tab renders real widgets, add the nine `PeopleApiService` stubs from Step 1 to that spec's API mock.

- [ ] **Step 6: Run to verify it fails**

Run: `npx ng test --include='src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts'`
Expected: the new test FAILS (only three tabs).

- [ ] **Step 7: Wire the tab into `employee-detail.component.ts`**

```ts
// line 29
type DetailTab = 'overview' | 'employment' | 'work-activity' | 'personal';
```

```ts
// imports: add
import { EmployeeWorkActivityTabComponent } from './work-activity-tab.component';
// and add EmployeeWorkActivityTabComponent to the @Component imports array
```

```html
<!-- template, right after the Employment tab block and before the Personal block -->
      @if (activeTab() === 'work-activity') {
        <app-employee-work-activity-tab [employeeId]="employee.id" />
      }
```

```ts
  readonly tabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'employment', label: 'Employment' },
    { id: 'work-activity', label: 'Work & Activity' },
    { id: 'personal', label: 'Personal' }
  ];
```

`@if` (not `[hidden]`) keeps the tab lazy: no request fires until someone opens it.

- [ ] **Step 8: Run the people module suite and build**

Run: `npx ng test --include='src/app/modules/people/**'`
Expected: all PASS.

Run: `npx ng build`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/work-activity-tab.component.ts src/app/modules/people/feature/employee-detail/work-activity-tab.component.spec.ts src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat(people): work & activity tab on the employee detail page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser verification against the real backend

Do this once 3A, 3B, 4A and 4B are running locally. No stubs.

- [ ] **Step 1:** Start the API and `npm start`. Open `/people/employees/{id}` for an employee who has tasks and tray data, and click **Work & Activity**.
- [ ] **Step 2:** Every card shows real numbers, or its honest empty state. Check them against the database:
  - Work summary equals the Overview tab's work numbers for the same month.
  - Needs attention lists only open tasks due by today + 3 days.
  - The last bar of the Delivery chart is the selected month.
- [ ] **Step 3:** Switch the month. The period cards reload; Needs attention and Recent tasks don't.
- [ ] **Step 4:** Sign in as a user without `monitoring:read` who is looking at someone else. The three agent cards show "no access", and the task cards still load (if they hold `tasks:read`).
- [ ] **Step 5:** Turn activity monitoring off for the employee (Settings → Monitoring). Recorded activity and Work pattern say "Activity monitoring is off for this employee."
- [ ] **Step 6:** Check the network tab. Opening Overview makes no `work-activity/*` calls; the tab loads lazily.
- [ ] **Step 6a:** As an HR/coverage viewer who is **not** a member of the task's project, click "View task". Work Management project visibility is relationship-based, so the board may refuse. If it does, render the task title as plain text in Needs attention and Recent tasks (drop the `routerLink`, keep the row), update both specs, and commit that as a follow-up.
- [ ] **Step 7:** Record the results in this plan's status line and in `SUMMARY.md`.

---

## Self-review

- **Mockup coverage:** Work summary, Needs attention, Delivery health, Recorded activity, Recent tasks, Application usage, Work pattern (Tasks 4–5) and the period filter (Task 6).
- **Deliberate deviations from the mockup:**
  - Story points sit in Delivery health only. `overview/work` has no story points, and 3A puts them on delivery.
  - Month-only period.
  - The "Review" pill is the task's own status name and colour.
- **No mock data:** every card reads `PeopleApiService`, and only specs stub it.
- **Names used across tasks:**
  - API methods: `getOverviewWork`, `getOverviewDelivery`, `getOverviewActivity`, `getWorkActivityNeedsAttention`, `getWorkActivityRecentTasks`, `getWorkActivityDeliveryTrend`, `getWorkActivityByHour`, `getWorkActivityAppUsage`, `getWorkActivityWorkPattern`
  - Utils: `formatMinutes`, `formatClock`, `percent`, `visibleHours`, `attentionLabel`, `shortMonth`, `hourLabel`
