# Employee Overview — Recent Activity & Final Layout (Plan 4B, frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the **Recent Activity** widget (newest-first feed with "Load older activity") and finish the Overview tab layout by adding Upcoming Items, Checklists, Employee History and Recent Activity.

**Architecture:** Recent Activity is a lifetime feed, not period-aware. The first page comes from `createWidgetLoader`; older pages are appended by an explicit "Load older activity" action that follows the response's `nextBefore` cursor. The Overview tab then gets one new row of three cards and a full-width feed.

**Tech Stack:** Angular 21 (standalone, OnPush, signal inputs), RxJS, Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/2026-09-30-employee-detail-redesign-design.md`. **Prerequisite:** Plan 4A frontend (`2026-09-30-employee-overview-upcoming-checklists-history-frontend.md`) fully committed — this plan uses its models, `getOverviewRecentActivity`, `formatActivityWhen`, and the three widgets. Backend counterpart: `HRMS-Backend-v1/docs/superpowers/plans/2026-09-30-employee-overview-recent-activity-backend.md`.

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Before every commit: `git branch --show-current` and `git status --short`; stage only the task's files. **No git worktrees.**
- Vitest (`vi.fn()`); component specs use globals; single file: `npx ng test --watch=false --include "<spec path>"`.
- **No permission logic on the frontend** and no new permission names; a 403 renders as the shared "no access" state.
- The feed is **partial by design** (`isPartial: true` from the API). The widget must say so ("Showing key activity — some actions are not recorded yet.") and must never imply completeness.
- The feed never shows text the employee typed (the API does not return it) — do not add any field that would.
- Activity times are shown in the viewer's local zone; the widget captures "now" once at construction so Today/Yesterday labels do not flicker.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Recent Activity widget

**Files:**
- Create: `src/app/modules/people/ui/overview-recent-activity-widget/overview-recent-activity-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `PeopleApiService.getOverviewRecentActivity(employeeId, before?, limit = 20)`, `createWidgetLoader`, `WidgetCardComponent`, `formatActivityWhen`, models `EmployeeActivityItem`, `EmployeeRecentActivityResponse`.
- Produces: `<app-overview-recent-activity-widget [employeeId]>` (required `employeeId: string`). First page size 20; "Load older activity" button (`data-testid="load-older"`) present only while a cursor exists.

- [ ] **Step 1: Write the failing test**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityItem, EmployeeRecentActivityResponse } from '../../models/employee-overview.model';
import { OverviewRecentActivityWidgetComponent } from './overview-recent-activity-widget.component';

describe('OverviewRecentActivityWidgetComponent', () => {
  const item = (id: string, over: Partial<EmployeeActivityItem> = {}): EmployeeActivityItem => ({
    id, kind: 'task_status_changed', action: 'Changed task status', target: 'WEB-12 Fix cart', detail: '→ In review',
    at: '2026-09-16T12:00:00+00:00', ...over
  });

  const firstPage: EmployeeRecentActivityResponse = {
    items: [
      item('a1'),
      item('a2', { kind: 'attendance_clock_in', action: 'Clocked in', target: null, detail: null }),
      item('a3', { kind: 'leave_requested', action: 'Requested leave', target: 'Annual leave', detail: null })
    ],
    nextBefore: '2026-09-15T12:00:00+00:00',
    isPartial: true
  };

  function setup(getOverviewRecentActivity: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewRecentActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewRecentActivity } }]
    });
    const fixture = TestBed.createComponent(OverviewRecentActivityWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const rows = (el: HTMLElement) => el.querySelectorAll('[data-testid="activity-item"]');
  const loadOlder = (el: HTMLElement) => el.querySelector('[data-testid="load-older"]') as HTMLButtonElement | null;

  it('requests the first page of 20 with no cursor', () => {
    const get = vi.fn().mockReturnValue(of(firstPage));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', null, 20);
  });

  it('lists each item with its action, target, detail and a date', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));

    expect(rows(el)).toHaveLength(3);
    expect(rows(el)[0].textContent).toContain('Changed task status');
    expect(rows(el)[0].textContent).toContain('WEB-12 Fix cart');
    expect(rows(el)[0].textContent).toContain('→ In review');
    expect(rows(el)[0].textContent).toContain('Sep 16');
    expect(rows(el)[1].textContent).toContain('Clocked in');
    expect(rows(el)[2].textContent).toContain('Annual leave');
  });

  it('always says the feed is partial when the API says so', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));

    expect(el.querySelector('[data-testid="partial-note"]')!.textContent).toContain('Showing key activity');
  });

  it('shows no partial note when the API does not flag the feed as partial', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...firstPage, isPartial: false })));

    expect(el.querySelector('[data-testid="partial-note"]')).toBeNull();
  });

  it('offers to load older activity only while a cursor exists', () => {
    const withCursor = setup(vi.fn().mockReturnValue(of(firstPage)));
    expect(loadOlder(withCursor.el)).toBeTruthy();

    TestBed.resetTestingModule();
    const noCursor = setup(vi.fn().mockReturnValue(of({ ...firstPage, nextBefore: null })));
    expect(loadOlder(noCursor.el)).toBeNull();
  });

  it('appends the older page, follows the new cursor, and hides the button at the end', () => {
    const older: EmployeeRecentActivityResponse = { items: [item('b1'), item('b2')], nextBefore: null, isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(older));
    const { fixture, el } = setup(get);

    loadOlder(el)!.click();
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-15T12:00:00+00:00', 20);
    expect(rows(el)).toHaveLength(5);
    expect(loadOlder(el)).toBeNull();
  });

  it('keeps following cursors across several pages', () => {
    const page2: EmployeeRecentActivityResponse = { items: [item('b1')], nextBefore: '2026-09-10T00:00:00+00:00', isPartial: true };
    const page3: EmployeeRecentActivityResponse = { items: [item('c1')], nextBefore: null, isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(page2)).mockReturnValueOnce(of(page3));
    const { fixture, el } = setup(get);

    loadOlder(el)!.click();
    fixture.detectChanges();
    loadOlder(el)!.click();
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-10T00:00:00+00:00', 20);
    expect(rows(el)).toHaveLength(5);
  });

  it('disables the button while an older page is loading and ignores extra clicks', () => {
    const pending = new Subject<EmployeeRecentActivityResponse>();
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(pending.asObservable());
    const { fixture, el } = setup(get);

    loadOlder(el)!.click();
    fixture.detectChanges();
    expect(loadOlder(el)!.disabled).toBe(true);

    loadOlder(el)!.click();
    expect(get).toHaveBeenCalledTimes(2);

    pending.next({ items: [item('b1')], nextBefore: null, isPartial: true });
    fixture.detectChanges();
    expect(rows(el)).toHaveLength(4);
  });

  it('shows an error under the list, keeps the items and the button, when loading older activity fails', () => {
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = setup(get);

    loadOlder(el)!.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="older-error"]')!.textContent).toContain('Could not load older activity');
    expect(rows(el)).toHaveLength(3);
    expect(loadOlder(el)).toBeTruthy();
    expect(loadOlder(el)!.disabled).toBe(false);
  });

  it('shows the empty state when there is no recorded activity', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403 and an error state with retry on other failures', () => {
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();

    TestBed.resetTestingModule();
    const get = vi.fn().mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 }))).mockReturnValueOnce(of(firstPage));
    const failed = setup(get);
    (failed.el.querySelector('app-error-state button') as HTMLButtonElement).click();
    failed.fixture.detectChanges();

    expect(get).toHaveBeenCalledTimes(2);
    expect(rows(failed.el)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-recent-activity-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the widget**

`overview-recent-activity-widget.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityItem, EmployeeRecentActivityResponse } from '../../models/employee-overview.model';
import { formatActivityWhen } from '../../utils/employee-overview.utils';

const PAGE_SIZE = 20;

/**
 * What the employee did, newest first. Lifetime (not period-aware) and partial by design: the API
 * builds it from existing tables, so some actions are not recorded - the widget says so.
 */
@Component({
  selector: 'app-overview-recent-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Recent Activity"
      [state]="loader.state()"
      errorMessage="Could not load recent activity."
      emptyMessage="No recorded activity yet."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of items(); track item.id) {
            <li class="flex items-start justify-between gap-4 py-2 text-sm" data-testid="activity-item">
              <div class="min-w-0">
                <p class="text-[var(--color-text-primary)]">
                  <span class="font-medium">{{ item.action }}</span>
                  @if (item.target) { <span> {{ item.target }}</span> }
                </p>
                @if (item.detail) {
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ item.detail }}</p>
                }
              </div>
              <span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ when(item) }}</span>
            </li>
          }
        </ul>

        @if (olderError()) {
          <p class="mt-2 text-xs text-[var(--color-danger-text)]" role="alert" data-testid="older-error">Could not load older activity. Try again.</p>
        }

        @if (hasMore()) {
          <button
            type="button"
            class="mt-3 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="load-older"
            [disabled]="loadingOlder()"
            (click)="loadOlder()"
          >
            {{ loadingOlder() ? 'Loading…' : 'Load older activity' }}
          </button>
        }

        @if (d.isPartial) {
          <p class="mt-3 text-xs text-[var(--color-text-secondary)]" data-testid="partial-note">
            Showing key activity — some actions are not recorded yet.
          </p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewRecentActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewRecentActivity(this.employeeId(), null, PAGE_SIZE),
    { isEmpty: (v) => v.items.length === 0 }
  );

  /**
   * Pages loaded after the first one. Tied to the exact first-page response they extend (`base`),
   * so a reload or an employee change produces a new response object and the stale pages simply
   * stop matching - no effect is needed to reset them.
   */
  private readonly paged = signal<{
    readonly base: EmployeeRecentActivityResponse;
    readonly items: readonly EmployeeActivityItem[];
    readonly cursor: string | null;
  } | null>(null);
  readonly loadingOlder = signal(false);
  readonly olderError = signal(false);

  /** Fixed at construction so "Today"/"Yesterday" do not change while the widget is open. */
  private readonly now = new Date();

  private readonly currentPaging = computed(() => {
    const first = this.loader.data();
    const paged = this.paged();
    return first && paged && paged.base === first ? paged : null;
  });

  readonly items = computed(() => [...(this.loader.data()?.items ?? []), ...(this.currentPaging()?.items ?? [])]);
  private readonly cursor = computed<string | null>(() => {
    const first = this.loader.data();
    if (!first) return null;
    const paging = this.currentPaging();
    return paging ? paging.cursor : first.nextBefore;
  });
  readonly hasMore = computed(() => this.cursor() !== null);

  when(item: EmployeeActivityItem): string {
    return formatActivityWhen(item.at, this.now);
  }

  loadOlder(): void {
    const first = this.loader.data();
    const before = this.cursor();
    if (!first || before === null || this.loadingOlder()) return;

    const employeeId = this.employeeId();
    this.loadingOlder.set(true);
    this.olderError.set(false);
    this.api
      .getOverviewRecentActivity(employeeId, before, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingOlder.set(false);
          if (employeeId !== this.employeeId()) return;
          const existing = this.currentPaging()?.items ?? [];
          this.paged.set({ base: first, items: [...existing, ...page.items], cursor: page.nextBefore });
        },
        error: () => {
          this.loadingOlder.set(false);
          this.olderError.set(true);
        }
      });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: same command as Step 2. Expected: 11 passed. If the "disables the button" test fails because the click on a disabled button still calls `loadOlder` in jsdom, that is the guard working: the extra click is ignored either by the `disabled` attribute or by the `loadingOlder()` early return — `get` must still have been called exactly twice.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-recent-activity-widget
git commit -m "feat(people): add overview recent activity widget with load-older paging

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Overview tab layout and spec stub updates

**Files:**
- Modify (edits): `src/app/modules/people/feature/employee-detail/overview-tab.component.ts`
- Test (new): `src/app/modules/people/feature/employee-detail/overview-tab.plan4.spec.ts`
- Modify (stubs): `src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts`, `overview-tab.layout.spec.ts`, `employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: the four Plan 4 widgets, the existing Overview tab.
- Produces: `<app-employee-overview-tab>` with a new row `Upcoming Items | Checklists | Employee History` and a full-width Recent Activity below the Productivity & Work Insights section.

- [ ] **Step 1: Write the failing test**

`overview-tab.plan4.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent plan 4 widgets', () => {
  function setup() {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(of({ from: '', to: '', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(of({ from: '', to: '', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })),
      getOverviewDelivery: vi.fn().mockReturnValue(of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })),
      getOverviewActivity: vi.fn().mockReturnValue(of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })),
      getOverviewApprovals: vi.fn().mockReturnValue(of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })),
      getOverviewUpcoming: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewChecklists: vi.fn().mockReturnValue(of({ groups: [] })),
      getOverviewHistory: vi.fn().mockReturnValue(of({ events: [] })),
      getOverviewRecentActivity: vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true }))
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

  it('renders the four new widgets', () => {
    const { el } = setup();

    for (const tag of [
      'app-overview-upcoming-widget',
      'app-overview-checklists-widget',
      'app-overview-history-widget',
      'app-overview-recent-activity-widget'
    ]) {
      expect(el.querySelector(tag), tag).toBeTruthy();
    }
  });

  it('places Upcoming, Checklists and History together, and Recent Activity after the insights section', () => {
    const { el } = setup();
    const upcoming = el.querySelector('app-overview-upcoming-widget')!;
    const row = upcoming.parentElement!;

    expect(row.querySelector('app-overview-checklists-widget')).toBeTruthy();
    expect(row.querySelector('app-overview-history-widget')).toBeTruthy();
    expect(el.querySelector('section[aria-labelledby="insights-heading"] app-overview-upcoming-widget')).toBeNull();

    const insights = el.querySelector('section[aria-labelledby="insights-heading"]')!;
    const activity = el.querySelector('app-overview-recent-activity-widget')!;
    expect(insights.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('loads each new widget once for the employee, with the documented page sizes', () => {
    const { api } = setup();

    expect(api.getOverviewUpcoming).toHaveBeenCalledWith('emp-1', 14);
    expect(api.getOverviewChecklists).toHaveBeenCalledWith('emp-1');
    expect(api.getOverviewHistory).toHaveBeenCalledWith('emp-1', 10);
    expect(api.getOverviewRecentActivity).toHaveBeenCalledWith('emp-1', null, 20);
  });

  it('does not refetch any of them when the month or the comparison changes', () => {
    const { fixture, api } = setup();
    const period = fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance;
    const compare = fixture.debugElement.query((d) => d.name === 'app-employee-compare-picker').componentInstance;

    period.onChange('2026-05');
    compare.onChange('previous');
    fixture.detectChanges();

    expect(api.getOverviewUpcoming).toHaveBeenCalledTimes(1);
    expect(api.getOverviewChecklists).toHaveBeenCalledTimes(1);
    expect(api.getOverviewHistory).toHaveBeenCalledTimes(1);
    expect(api.getOverviewRecentActivity).toHaveBeenCalledTimes(1);
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/overview-tab.plan4.spec.ts"`
Expected: FAIL — the tab does not render the new widgets.

- [ ] **Step 3: Edit the Overview tab**

Re-read `overview-tab.component.ts` first; then make three edits.

(a) After the line
```ts
import { OverviewWorkWidgetComponent } from '../../ui/overview-work-widget/overview-work-widget.component';
```
add:
```ts
import { OverviewChecklistsWidgetComponent } from '../../ui/overview-checklists-widget/overview-checklists-widget.component';
import { OverviewHistoryWidgetComponent } from '../../ui/overview-history-widget/overview-history-widget.component';
import { OverviewRecentActivityWidgetComponent } from '../../ui/overview-recent-activity-widget/overview-recent-activity-widget.component';
import { OverviewUpcomingWidgetComponent } from '../../ui/overview-upcoming-widget/overview-upcoming-widget.component';
```

(b) In the `imports: [ … ]` array, replace

```ts
    OverviewDeliveryWidgetComponent
  ],
```
with
```ts
    OverviewDeliveryWidgetComponent,
    OverviewUpcomingWidgetComponent,
    OverviewChecklistsWidgetComponent,
    OverviewHistoryWidgetComponent,
    OverviewRecentActivityWidgetComponent
  ],
```

(c) In the template, replace

```html
        <app-overview-delivery-widget [employeeId]="employeeId()" />
      </div>
    </section>
  `,
```
with
```html
        <app-overview-delivery-widget [employeeId]="employeeId()" />
      </div>
    </section>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <app-overview-upcoming-widget [employeeId]="employeeId()" />
      <app-overview-checklists-widget [employeeId]="employeeId()" />
      <app-overview-history-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4">
      <app-overview-recent-activity-widget [employeeId]="employeeId()" />
    </div>
  `,
```

Also update the class doc comment's last sentence to: `Upcoming Items, Checklists, Employee History and Recent Activity are lifetime/forward-looking and ignore both the month and the comparison.`

- [ ] **Step 4: Update the three existing spec stubs (they now render widgets that call four more API methods)**

In **each** of `overview-tab.component.spec.ts` (the `api` object), `overview-tab.layout.spec.ts` (the `api` object) and `employee-detail.component.spec.ts` (the `apiStub` object), add these four properties directly after the existing `getOverviewApprovals: …` property (add a comma after that property's closing `)` if it was the last property):

```ts
      getOverviewUpcoming: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewChecklists: vi.fn().mockReturnValue(of({ groups: [] })),
      getOverviewHistory: vi.fn().mockReturnValue(of({ events: [] })),
      getOverviewRecentActivity: vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true })),
```

(In `employee-detail.component.spec.ts` the surrounding object already ends properties with trailing commas; keep that style.) No assertion in those files changes.

- [ ] **Step 5: Run the detail-folder specs, the whole people module, and a build**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/*.spec.ts"`
Expected: all pass (plan4 spec 4, layout spec 4, overview-tab spec 3, detail spec, employment/personal tab specs).

Run: `npx ng test --watch=false --include "src/app/modules/people/**/*.spec.ts"` — Expected: all pass.
Run: `npx ng build` — Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/feature/employee-detail/overview-tab.component.ts src/app/modules/people/feature/employee-detail/overview-tab.plan4.spec.ts src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts src/app/modules/people/feature/employee-detail/overview-tab.layout.spec.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat(people): add upcoming, checklists, history and recent activity to the overview

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Live verification (no code)

**Files:** none. Requires the Plan 4 backend endpoints running against a dev tenant.

- [ ] **Step 1:** Start the frontend via the launch config (`preview_start`) and sign in as a dev-tenant user who can open the employee. Open an employee with history. Overview is the default tab.
- [ ] **Step 2 — Layout:** below "Productivity & Work Insights": a row of Upcoming Items / Checklists / Employee History, then a full-width Recent Activity. Nothing overlaps at desktop width; on mobile (`resize_window` preset `mobile`) the widgets stack with no horizontal page scroll.
- [ ] **Step 3 — Upcoming:** items are earliest-first with the right chip (Calendar / Approved / Release); an all-day item shows a date or range, a timed calendar event shows its local time; a **private** calendar event of that employee does **not** appear.
- [ ] **Step 4 — Checklists / History:** each checklist group's bar equals completed ÷ total, bypassed tasks are noted separately; History shows Joined / Position changed / Reporting manager changed / Leave approved / Checklist completed as recorded, newest first, dated with a year. Confirm there is no "status changed" entry (none is recorded).
- [ ] **Step 5 — Recent Activity:** newest first with wording like "Changed task status WEB-12 …"; no comment text anywhere; the "Showing key activity — some actions are not recorded yet." note is visible; "Load older activity" appends older items without repeating any, and disappears at the end.
- [ ] **Step 6 — Independence:** with `read_network_requests`, change the month and turn comparison on: **none** of `upcoming`, `checklists`, `history`, `recent-activity` is requested again. Kill the API briefly: each widget shows its own error state and recovers with "Try again"; a 403 shows "You do not have access to this section." only in the affected widget.
- [ ] **Step 7:** `read_console_messages` shows no errors. Report faithfully what data existed (an employee with no history legitimately shows empty states) and what could not be exercised. Screenshot the populated Overview.

---

## Self-review

- Completes the Overview design's remaining widgets: Upcoming Items (calendar, leave, releases), Checklists, Employee History, Recent Activity — all lifetime/forward-looking and independent of the month/comparison controls (asserted by a test).
- Honesty guarantees enforced in code and tests: the partial-feed note is rendered from the API flag, the feed shows no typed text, and History never claims status changes.
- No permission logic exists on the frontend; a 403 is handled per widget by the shared loader.
- Type/name consistency: `getOverviewRecentActivity(id, null, 20)` first-page call and `(id, cursor, 20)` follow-ups match Plan 4A's API method and the specs; `EmployeeActivityItem`/`EmployeeRecentActivityResponse` fields match the backend records; selectors used in the Overview template and in `overview-tab.plan4.spec.ts` are identical to the widgets' `selector` values.
- Verified by reading source: the committed Overview tab (Plan 3 layout) — the three edit anchors are its current text; `createWidgetLoader`/`WidgetCardComponent` contracts. Not compile-checked or run: the executor's first test run is the first compile. Fix compile errors by aligning to real signatures, never by weakening a test. If an `Edit` anchor does not match (another session may have reformatted the file), re-read the file and place the same changes by hand; the intent is fixed.
- Known limits: the feed has no filtering and no virtual scrolling (pages of 20 are small); "Today/Yesterday" use the viewer's zone; History has no "view all".
