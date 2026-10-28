# Employee Overview — Insights, Approvals & Layout (Plan 3B, frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the Plan 3 Overview: an **Activity** widget, **comparison deltas** on the Attendance Discipline widget, an **Approval Activity** widget, and the Overview tab layout that groups Activity / Discipline / Delivery under "Productivity & Work Insights" with a compare picker.

**Architecture:** Same widget pattern as Plans 2/3A. The Overview tab (which provides the `EmployeePeriodStore`) gains the compare picker and four new widgets. Discipline is retrofitted to pass `comparePrevious` and show `DeltaBadgeComponent`s when the response has `previous`.

**Tech Stack:** Angular 21, `@ngrx/signals`, RxJS, Vitest.

**Spec:** `docs/superpowers/specs/finished/2026-09-30/2026-09-30-employee-detail-redesign-design.md`. **Prerequisite:** Plan 3A frontend (`2026-09-30-employee-overview-work-delivery-frontend.md`) fully committed — this plan uses its models, API methods, `formatMinutes`/`computeDelta`/`formatShortDate`, `DeltaBadgeComponent`, `EmployeeComparePickerComponent`, the store's `comparePrevious`/`setCompare`, and the Work/Delivery widgets.

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Before every commit: `git branch --show-current` and `git status --short`; stage only the task's files. **No git worktrees.**
- Vitest (`vi.fn()`); component specs use globals; single file: `npx ng test --watch=false --include "<spec path>"`.
- Widgets use `app-widget-card` + `createWidgetLoader`; no `rxResource`.
- Deltas: Activity active time = higher-better, idle time = lower-better, meeting time = neutral; every Discipline metric = lower-better; only shown when `previous` is present.
- Location violations delta only when both current and previous are numbers (tracking on).
- Approver names appear only when the API returns them (Work Management items); never invent "Awaiting …" for other kinds.
- Changing an existing assertion is allowed **only** where this plan says so (the discipline API now takes a 4th `comparePrevious` argument, so calls are asserted with a trailing `false`).
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Activity widget

**Files:**
- Create: `src/app/modules/people/ui/overview-activity-widget/overview-activity-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `PeopleApiService.getOverviewActivity(employeeId, from, to, comparePrevious)`, `EmployeePeriodStore`, `createWidgetLoader`, `WidgetCardComponent`, `computeDelta`, `formatMinutes`, `DeltaBadgeComponent`.
- Produces: `<app-overview-activity-widget [employeeId]>` (required `employeeId: string`; refetches on month or compare change).

- [ ] **Step 1: Write the failing test**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewActivityWidgetComponent } from './overview-activity-widget.component';

describe('OverviewActivityWidgetComponent', () => {
  const response: EmployeeActivityOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    activityMonitoringEnabled: true,
    activeMinutes: 150,
    idleMinutes: 72,
    meetingMinutes: 65,
    daysWithData: 12,
    previous: null
  };

  function setup(getOverviewActivity: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewActivity } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewActivityWidgetComponent);
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

  it('shows active, idle and meeting time as hours and minutes', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'activity-active')).toContain('2h 30m');
    expect(text(el, 'activity-idle')).toContain('1h 12m');
    expect(text(el, 'activity-meeting')).toContain('1h 05m');
  });

  it('shows deltas with the right tone: more active is good, more idle is bad, meetings are neutral', () => {
    const previous = { activeMinutes: 100, idleMinutes: 50, meetingMinutes: 30, daysWithData: 10 };
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, previous })));
    const delta = (id: string) => el.querySelector(`[data-testid="${id}"] [data-testid="delta"]`)!;

    expect(delta('activity-active-delta').textContent).toContain('+0h 50m');
    expect(delta('activity-active-delta').classList.contains('delta--good')).toBe(true);
    expect(delta('activity-idle-delta').classList.contains('delta--bad')).toBe(true);
    expect(delta('activity-meeting-delta').classList.contains('delta--neutral')).toBe(true);
  });

  it('shows no deltas without previous data', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
  });

  it('says monitoring is not enabled when the employee is not monitored', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, activityMonitoringEnabled: false, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('not enabled');
  });

  it('says nothing was recorded when monitoring is on but no day has data', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, daysWithData: 0, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('No activity recorded');
  });

  it('asks for the previous period once comparison is on, and refetches on a month change', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setCompare('previous');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-01', '2026-09-30', true);

    store.setMonth('2026-08');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', true);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-activity-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the widget**

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { Delta, computeDelta, formatMinutes } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Activity"
      [state]="loader.state()"
      [emptyMessage]="emptyText()"
      errorMessage="Could not load activity."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Active time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-active">{{ minutes(d.activeMinutes) }}</span>
              <span data-testid="activity-active-delta"><app-delta-badge [delta]="activeDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Idle time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-idle">{{ minutes(d.idleMinutes) }}</span>
              <span data-testid="activity-idle-delta"><app-delta-badge [delta]="idleDelta(d)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-[var(--color-text-secondary)]">Meeting time</dt>
            <dd class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <span data-testid="activity-meeting">{{ minutes(d.meetingMinutes) }}</span>
              <span data-testid="activity-meeting-delta"><app-delta-badge [delta]="meetingDelta(d)" /></span>
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-xs text-[var(--color-text-secondary)]">Based on {{ d.daysWithData }} {{ d.daysWithData === 1 ? 'day' : 'days' }} of recorded activity</p>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewActivity(this.employeeId(), this.period.from(), this.period.to(), this.period.comparePrevious()),
    { isEmpty: (v) => !v.activityMonitoringEnabled || v.daysWithData === 0 }
  );

  minutes = formatMinutes;

  emptyText(): string {
    const d = this.loader.data();
    return d && !d.activityMonitoringEnabled
      ? 'Activity monitoring is not enabled for this employee.'
      : 'No activity recorded for this period.';
  }

  activeDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.activeMinutes, d.previous.activeMinutes, 'higher-better', formatMinutes) : null;
  }

  idleDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.idleMinutes, d.previous.idleMinutes, 'lower-better', formatMinutes) : null;
  }

  meetingDelta(d: EmployeeActivityOverviewResponse): Delta | null {
    return d.previous ? computeDelta(d.meetingMinutes, d.previous.meetingMinutes, 'neutral', formatMinutes) : null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: same command as Step 2. Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-activity-widget
git commit -m "feat(people): add overview activity widget

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Discipline comparison deltas

**Files:**
- Modify (full rewrite): `src/app/modules/people/ui/overview-discipline-widget/overview-discipline-widget.component.ts`
- Modify (two assertions): `src/app/modules/people/ui/overview-discipline-widget/overview-discipline-widget.component.spec.ts`
- Test (new): `src/app/modules/people/ui/overview-discipline-widget/overview-discipline-widget.compare.spec.ts`

**Interfaces:**
- Consumes: `getOverviewAttendanceDiscipline(employeeId, from, to, comparePrevious)` (Plan 3A T1), `EmployeePeriodStore.comparePrevious`, `computeDelta`, `DeltaBadgeComponent`, `EmployeeAttendanceDisciplineResponse.previous`.
- Produces: the same `<app-overview-discipline-widget [employeeId]>` with deltas; layout becomes a single column so it fits a one-third-width card.

- [ ] **Step 1: Update the two existing assertions (they must now expect the trailing argument)**

In `overview-discipline-widget.component.spec.ts` replace exactly:

```ts
    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
```
with
```ts
    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
```

and

```ts
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
```
with
```ts
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', false);
```

- [ ] **Step 2: Write the failing compare tests**

`overview-discipline-widget.compare.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDisciplineWidgetComponent } from './overview-discipline-widget.component';

describe('OverviewDisciplineWidgetComponent comparison', () => {
  const current: EmployeeAttendanceDisciplineResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    lateClockIns: 2,
    earlyClockOuts: 1,
    missingClockOuts: 0,
    overBreakDays: 3,
    overBreakMinutes: 45,
    locationTrackingEnabled: true,
    locationViolations: 4,
    previous: { lateClockIns: 5, earlyClockOuts: 1, missingClockOuts: 1, overBreakDays: 1, overBreakMinutes: 10, locationViolations: 1 }
  };

  function setup(response: EmployeeAttendanceDisciplineResponse) {
    const get = vi.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({
      imports: [OverviewDisciplineWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendanceDiscipline: get } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDisciplineWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, get, el: fixture.nativeElement as HTMLElement };
  }

  const delta = (el: HTMLElement, key: string) =>
    el.querySelector(`[data-testid="discipline-${key}-delta"] [data-testid="delta"]`);

  it('shows a good delta when a lower-is-better metric dropped, and a bad one when it rose', () => {
    const { el } = setup(current);

    expect(delta(el, 'late')!.textContent).toContain('-3');
    expect(delta(el, 'late')!.classList.contains('delta--good')).toBe(true);
    expect(delta(el, 'over-break')!.textContent).toContain('+2');
    expect(delta(el, 'over-break')!.classList.contains('delta--bad')).toBe(true);
    expect(delta(el, 'location')!.classList.contains('delta--bad')).toBe(true);
  });

  it('shows a flat delta when a metric is unchanged', () => {
    const { el } = setup(current);

    expect(delta(el, 'early')!.textContent).toContain('No change');
  });

  it('shows no deltas without previous data', () => {
    const { el } = setup({ ...current, previous: null });

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
  });

  it('skips the location delta when either side has no location figure', () => {
    const { el } = setup({ ...current, locationTrackingEnabled: false, locationViolations: null, previous: { ...current.previous!, locationViolations: null } });

    expect(delta(el, 'location')).toBeNull();
  });

  it('asks the API for the previous period once comparison is on', () => {
    const { fixture, get } = setup(current);

    TestBed.inject(EmployeePeriodStore).setCompare('previous');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-01', '2026-09-30', true);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-discipline-widget/*.spec.ts"`
Expected: FAIL — the widget still calls the API with 3 arguments and renders no deltas.

- [ ] **Step 4: Rewrite the widget**

Replace the whole of `overview-discipline-widget.component.ts` with:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { Delta, computeDelta } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-discipline-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Attendance Discipline"
      [state]="loader.state()"
      errorMessage="Could not load attendance discipline."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <dl class="grid grid-cols-1 gap-y-3 text-sm">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Late clock-ins</dt>
            <dd class="flex items-center gap-2 font-semibold">
              <span [class.text-[var(--color-danger-text)]]="d.lateClockIns > 0" data-testid="discipline-late">{{ d.lateClockIns }}</span>
              <span data-testid="discipline-late-delta"><app-delta-badge [delta]="lowerBetter(d.lateClockIns, d.previous?.lateClockIns)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Early clock-outs</dt>
            <dd class="flex items-center gap-2 font-semibold">
              <span [class.text-[var(--color-danger-text)]]="d.earlyClockOuts > 0" data-testid="discipline-early">{{ d.earlyClockOuts }}</span>
              <span data-testid="discipline-early-delta"><app-delta-badge [delta]="lowerBetter(d.earlyClockOuts, d.previous?.earlyClockOuts)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Missing clock-outs</dt>
            <dd class="flex items-center gap-2 font-semibold">
              <span [class.text-[var(--color-danger-text)]]="d.missingClockOuts > 0" data-testid="discipline-missing">{{ d.missingClockOuts }}</span>
              <span data-testid="discipline-missing-delta"><app-delta-badge [delta]="lowerBetter(d.missingClockOuts, d.previous?.missingClockOuts)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt class="text-[var(--color-text-secondary)]">Over break</dt>
            <dd class="flex items-center gap-2 font-semibold">
              <span [class.text-[var(--color-danger-text)]]="d.overBreakDays > 0" data-testid="discipline-over-break">{{ overBreakText(d) }}</span>
              <span data-testid="discipline-over-break-delta"><app-delta-badge [delta]="lowerBetter(d.overBreakDays, d.previous?.overBreakDays)" /></span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 pb-2">
            <dt class="text-[var(--color-text-secondary)]">Outside work location</dt>
            <dd class="flex items-center gap-2 font-semibold">
              <span [class.text-[var(--color-danger-text)]]="(d.locationViolations ?? 0) > 0" data-testid="discipline-location">{{ locationText(d) }}</span>
              <span data-testid="discipline-location-delta"><app-delta-badge [delta]="lowerBetter(d.locationViolations, d.previous?.locationViolations)" /></span>
            </dd>
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
    this.api.getOverviewAttendanceDiscipline(
      this.employeeId(), this.period.from(), this.period.to(), this.period.comparePrevious()
    )
  );

  /** Delta for a metric where fewer is better; null unless both sides have a number. */
  lowerBetter(current: number | null | undefined, previous: number | null | undefined): Delta | null {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    return computeDelta(current, previous, 'lower-better');
  }

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

- [ ] **Step 5: Run to verify all discipline specs pass**

Run: same command as Step 3. Expected: the 7 existing tests (with the two updated assertions) and the 5 new ones pass.

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-discipline-widget
git commit -m "feat(people): add previous-period deltas to the discipline widget

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Approval Activity widget

**Files:**
- Create: `src/app/modules/people/ui/overview-approvals-widget/overview-approvals-widget.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `PeopleApiService.getOverviewApprovals(employeeId, from, to)`, `EmployeePeriodStore`, `createWidgetLoader`, `WidgetCardComponent`, `formatShortDate`, models `EmployeeApprovalActivityResponse`/`EmployeeApprovalItem`.
- Produces: `<app-overview-approvals-widget [employeeId]>` (required `employeeId: string`; refetches on month change; empty when `total === 0`).

- [ ] **Step 1: Write the failing test**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeApprovalActivityResponse, EmployeeApprovalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewApprovalsWidgetComponent } from './overview-approvals-widget.component';

describe('OverviewApprovalsWidgetComponent', () => {
  const item = (over: Partial<EmployeeApprovalItem>): EmployeeApprovalItem => ({
    id: 'i1', kind: 'leave', label: 'Leave request', detail: 'Annual leave · 2026-09-23 → 2026-09-25',
    status: 'pending', requestedAt: '2026-09-12T09:00:00+00:00', decidedAt: null, approverName: null, ...over
  });

  const response: EmployeeApprovalActivityResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    pending: 2,
    approved: 1,
    rejected: 1,
    total: 4,
    items: [
      item({ id: 'i1' }),
      item({ id: 'i2', kind: 'task_creation', label: 'Task creation', detail: 'Checkout', approverName: 'Abitha Devendran', requestedAt: '2026-09-10T09:00:00+00:00' }),
      item({ id: 'i3', kind: 'attendance_correction', label: 'Attendance correction', detail: '2026-09-04 · clock out', status: 'approved', requestedAt: '2026-09-05T09:00:00+00:00', decidedAt: '2026-09-06T09:00:00+00:00' }),
      item({ id: 'i4', kind: 'work_area_change', label: 'Work area change', detail: null, status: 'rejected', requestedAt: '2026-09-02T09:00:00+00:00' })
    ]
  };

  function setup(getOverviewApprovals: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewApprovalsWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewApprovals } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewApprovalsWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the pending, approved and rejected counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const counts = el.querySelector('[data-testid="approvals-counts"]')!.textContent!;

    expect(counts).toContain('2');
    expect(counts).toContain('Pending');
    expect(counts).toContain('Approved');
    expect(counts).toContain('Rejected');
  });

  it('lists each item with its label, detail, status and short date', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="approval-item"]');

    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('Leave request');
    expect(rows[0].textContent).toContain('Annual leave · 2026-09-23 → 2026-09-25');
    expect(rows[0].textContent).toContain('Pending');
    expect(rows[0].textContent).toContain('Sep 12');
    expect(rows[2].textContent).toContain('Approved');
    expect(rows[3].textContent).toContain('Rejected');
  });

  it('shows who a pending Work Management request is awaiting, and nothing for other kinds', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="approval-item"]');

    expect(rows[1].textContent).toContain('Awaiting Abitha Devendran');
    expect(rows[0].textContent).not.toContain('Awaiting');
  });

  it('shows who decided a decided request when the API names them', () => {
    const decided: EmployeeApprovalActivityResponse = {
      ...response,
      items: [item({ id: 'd1', kind: 'task_edit', label: 'Task edit', status: 'approved', approverName: 'Grace Hopper', decidedAt: '2026-09-11T09:00:00+00:00' })]
    };
    const { el } = setup(vi.fn().mockReturnValue(of(decided)));

    expect(el.querySelector('[data-testid="approval-item"]')!.textContent).toContain('by Grace Hopper');
  });

  it('tags each row with its status class for styling', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const pills = el.querySelectorAll('[data-testid="approval-status"]');

    expect(pills[0].classList.contains('pill--pending')).toBe(true);
    expect(pills[2].classList.contains('pill--approved')).toBe(true);
    expect(pills[3].classList.contains('pill--rejected')).toBe(true);
  });

  it('notes how many older items are not listed', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, total: 14 })));

    expect(el.textContent).toContain('Showing the latest 4 of 14');
  });

  it('shows the empty state when there are no requests', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, pending: 0, approved: 0, rejected: 0, total: 0, items: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('refetches when the month changes and shows the no-access state on 403', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');

    TestBed.resetTestingModule();
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/overview-approvals-widget/*.spec.ts"`
Expected: FAIL — component unresolved.

- [ ] **Step 3: Write the widget**

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { ApprovalStatus, EmployeeApprovalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatShortDate } from '../../utils/employee-overview.utils';

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

@Component({
  selector: 'app-overview-approvals-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Approval Activity"
      [state]="loader.state()"
      errorMessage="Could not load approval activity."
      emptyMessage="No approval requests in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <p class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]" data-testid="approvals-counts">
          <span><strong class="text-[var(--color-text-primary)]">{{ d.pending }}</strong> Pending</span>
          <span><strong class="text-[var(--color-text-primary)]">{{ d.approved }}</strong> Approved</span>
          <span><strong class="text-[var(--color-text-primary)]">{{ d.rejected }}</strong> Rejected</span>
        </p>

        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of d.items; track item.id) {
            <li class="flex items-start justify-between gap-3 py-2 text-sm" data-testid="approval-item">
              <div class="min-w-0">
                <p class="font-medium text-[var(--color-text-primary)]">{{ item.label }}</p>
                @if (item.detail) {
                  <p class="truncate text-xs text-[var(--color-text-secondary)]">{{ item.detail }}</p>
                }
                @if (approverNote(item); as note) {
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ note }}</p>
                }
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="pill" data-testid="approval-status" [class]="'pill--' + item.status">{{ statusLabel(item.status) }}</span>
                <span class="text-xs text-[var(--color-text-secondary)]">{{ shortDate(item.requestedAt) }}</span>
              </div>
            </li>
          }
        </ul>

        @if (d.total > d.items.length) {
          <p class="mt-2 text-xs text-[var(--color-text-secondary)]">Showing the latest {{ d.items.length }} of {{ d.total }}</p>
        }
      }
    </app-widget-card>
  `,
  styles: [`
    .pill { border-radius: 9999px; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; }
    .pill--pending { background: #fef3c7; color: #92400e; }
    .pill--approved { background: #dcfce7; color: #166534; }
    .pill--rejected { background: #fee2e2; color: #991b1b; }
    .pill--cancelled { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewApprovalsWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewApprovals(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.total === 0 }
  );

  shortDate = formatShortDate;

  statusLabel(status: ApprovalStatus): string {
    return STATUS_LABELS[status];
  }

  /** "Awaiting X" for a pending request, "by X" for a decided one - only when the API names an approver. */
  approverNote(item: EmployeeApprovalItem): string | null {
    if (!item.approverName) return null;
    if (item.status === 'pending') return `Awaiting ${item.approverName}`;
    return item.decidedAt ? `by ${item.approverName}` : null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: same command as Step 2. Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/overview-approvals-widget
git commit -m "feat(people): add overview approval activity widget

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Overview tab layout + spec stub updates

**Files:**
- Modify (full rewrite): `src/app/modules/people/feature/employee-detail/overview-tab.component.ts`
- Modify (edits): `src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts`
- Test (new): `src/app/modules/people/feature/employee-detail/overview-tab.layout.spec.ts`
- Modify (edit): `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: all Plan 2 and Plan 3 widgets, `EmployeePeriodPickerComponent`, `EmployeeComparePickerComponent`.
- Produces: `<app-employee-overview-tab [employeeId]>` rendering eight widgets (Attendance, Time Off, Work Management, Approval Activity, then Activity / Attendance Discipline / Delivery under "Productivity & Work Insights") with both pickers.

- [ ] **Step 1: Write the failing layout test**

`overview-tab.layout.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent layout', () => {
  function setup() {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(of({ from: '', to: '', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(of({ from: '', to: '', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })),
      getOverviewDelivery: vi.fn().mockReturnValue(of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })),
      getOverviewActivity: vi.fn().mockReturnValue(of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })),
      getOverviewApprovals: vi.fn().mockReturnValue(of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] }))
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

  it('renders both pickers and all seven widgets', () => {
    const { el } = setup();

    for (const tag of [
      'app-employee-period-picker',
      'app-employee-compare-picker',
      'app-overview-attendance-widget',
      'app-overview-time-off-widget',
      'app-overview-work-widget',
      'app-overview-approvals-widget',
      'app-overview-activity-widget',
      'app-overview-discipline-widget',
      'app-overview-delivery-widget'
    ]) {
      expect(el.querySelector(tag), tag).toBeTruthy();
    }
  });

  it('groups Activity, Discipline and Delivery under the Productivity & Work Insights heading', () => {
    const { el } = setup();
    const section = el.querySelector('section[aria-labelledby="insights-heading"]')!;

    expect(section.querySelector('#insights-heading')!.textContent).toContain('Productivity & Work Insights');
    expect(section.querySelector('app-overview-activity-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-discipline-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-delivery-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-attendance-widget')).toBeNull();
  });

  it('loads every new widget for the employee', () => {
    const { api } = setup();

    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewApprovals).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewActivity).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
  });

  it('switching comparison on refetches only the comparison-capable widgets, with compare=true', () => {
    const { fixture, api, el } = setup();
    const picker = fixture.debugElement.query((d) => d.name === 'app-employee-compare-picker').componentInstance;
    expect(el.querySelector('app-employee-compare-picker')).toBeTruthy();

    picker.onChange('previous');
    fixture.detectChanges();

    expect(api.getOverviewActivity).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewDelivery).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(1);
    expect(api.getOverviewWork).toHaveBeenCalledTimes(1);
    expect(api.getOverviewApprovals).toHaveBeenCalledTimes(1);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/overview-tab.layout.spec.ts"`
Expected: FAIL — the tab does not render the new widgets or the compare picker.

- [ ] **Step 3: Rewrite the Overview tab**

Replace the whole of `overview-tab.component.ts` with:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from '../../ui/employee-compare-picker/employee-compare-picker.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { OverviewActivityWidgetComponent } from '../../ui/overview-activity-widget/overview-activity-widget.component';
import { OverviewApprovalsWidgetComponent } from '../../ui/overview-approvals-widget/overview-approvals-widget.component';
import { OverviewAttendanceWidgetComponent } from '../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDeliveryWidgetComponent } from '../../ui/overview-delivery-widget/overview-delivery-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewTimeOffWidgetComponent } from '../../ui/overview-time-off-widget/overview-time-off-widget.component';
import { OverviewWorkWidgetComponent } from '../../ui/overview-work-widget/overview-work-widget.component';

/**
 * Overview tab. Owns the month selection and the optional previous-period comparison (its own
 * EmployeePeriodStore instance, so both reset per employee page). Every widget loads independently.
 * All read the month except Time Off (year-based); only Activity, Attendance Discipline and Delivery
 * use the comparison.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    EmployeeComparePickerComponent,
    OverviewAttendanceWidgetComponent,
    OverviewTimeOffWidgetComponent,
    OverviewWorkWidgetComponent,
    OverviewApprovalsWidgetComponent,
    OverviewActivityWidgetComponent,
    OverviewDisciplineWidgetComponent,
    OverviewDeliveryWidgetComponent
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-[var(--color-text-secondary)]">Activity for the selected period</p>
      <div class="flex flex-wrap items-center gap-2">
        <app-employee-period-picker />
        <app-employee-compare-picker />
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-attendance-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-time-off-widget [employeeId]="employeeId()" />
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <app-overview-work-widget [employeeId]="employeeId()" />
      </div>
      <app-overview-approvals-widget [employeeId]="employeeId()" />
    </div>

    <section class="mt-6" aria-labelledby="insights-heading">
      <h2 id="insights-heading" class="text-base font-semibold text-[var(--color-text-primary)]">Productivity &amp; Work Insights</h2>
      <p class="text-sm text-[var(--color-text-secondary)]">A period-based view of activity, attendance discipline and delivery.</p>
      <div class="mt-3 grid gap-4 lg:grid-cols-3">
        <app-overview-activity-widget [employeeId]="employeeId()" />
        <app-overview-discipline-widget [employeeId]="employeeId()" />
        <app-overview-delivery-widget [employeeId]="employeeId()" />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  readonly employeeId = input.required<string>();
}
```

- [ ] **Step 4: Update the existing Overview-tab spec (mock + the two discipline assertions)**

In `overview-tab.component.spec.ts`:

(a) Extend the API mock. Replace exactly

```ts
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null }))
```
with
```ts
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(
        of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })
      ),
      getOverviewDelivery: vi.fn().mockReturnValue(
        of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })
      ),
      getOverviewActivity: vi.fn().mockReturnValue(
        of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })
      ),
      getOverviewApprovals: vi.fn().mockReturnValue(
        of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })
      )
```

(b) Replace exactly
```ts
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
```
with
```ts
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
```
and exactly
```ts
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
```
with
```ts
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31', false);
```

If an anchor does not match (Plan 2's executor may have formatted it slightly differently), find the equivalent line and make the same change; the intent is fixed: the discipline call now has a trailing `false`, and the mock must expose the four new methods.

- [ ] **Step 5: Update the detail-page spec stub (the Overview tab now renders by default)**

In `employee-detail.component.spec.ts`, inside `setup(...)`'s `apiStub`, replace exactly

```ts
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
```
with
```ts
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(
        of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })
      ),
      getOverviewDelivery: vi.fn().mockReturnValue(
        of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })
      ),
      getOverviewActivity: vi.fn().mockReturnValue(
        of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })
      ),
      getOverviewApprovals: vi.fn().mockReturnValue(
        of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })
      ),
```

- [ ] **Step 6: Run the new and updated specs, then the whole people module and a build**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/*.spec.ts"`
Expected: all pass (layout spec 4, overview-tab spec 3, detail spec unchanged count, employment/personal tab specs).

Run: `npx ng test --watch=false --include "src/app/modules/people/**/*.spec.ts"` — Expected: all pass.
Run: `npx ng build` — Expected: succeeds (catches unused imports and strict-template errors the specs do not).

- [ ] **Step 7: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/feature/employee-detail/overview-tab.component.ts src/app/modules/people/feature/employee-detail/overview-tab.component.spec.ts src/app/modules/people/feature/employee-detail/overview-tab.layout.spec.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat(people): lay out the full overview with insights section and compare picker

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Live verification (no code)

**Files:** none. Requires the Plan 3 backend endpoints running against a dev tenant with attendance, task and monitoring data.

- [ ] **Step 1:** Start the frontend via the launch config (`preview_start`) and sign in as a dev-tenant user with `employees:read`, `attendance:read`, `leave:read`, `tasks:read`, `monitoring:read`. Open an employee with history. The **Overview** tab is default.
- [ ] **Step 2 — Layout:** row 1 Attendance + Time Off; row 2 Work Management + Approval Activity; below, the "Productivity & Work Insights" heading with Activity / Attendance Discipline / Delivery. Both pickers sit top-right.
- [ ] **Step 3 — Numbers make sense:** Work Management counts add up (completed + in progress + overdue + not started = assigned) and the bar segments match them; Delivery fractions are consistent with Work Management; Activity times are `Xh YYm`; Approval Activity lists newest first with "Awaiting …" only on Work Management items.
- [ ] **Step 4 — Independence:** with `read_network_requests`, change the month: `overview/attendance`, `attendance-discipline`, `work`, `delivery`, `activity`, `approvals` refetch with the new range; `overview/time-off` does not. Switch comparison to "Compare to previous period": **only** `activity`, `delivery` and `attendance-discipline` refetch, now with `compare=previous`; deltas (▲/▼) appear with sensible tones (more idle time = red, fewer late clock-ins = green).
- [ ] **Step 5 — States:** an employee without location verification shows "Not monitored"; one without activity monitoring shows "Activity monitoring is not enabled…"; a user lacking `tasks:read` viewing someone else sees "You do not have access to this section." in Work/Delivery/Approvals' work items while other widgets still render; viewing your own record works without those permissions; killing the API briefly shows error states that recover via "Try again".
- [ ] **Step 6:** `read_console_messages` shows no errors; resize to mobile: no horizontal scroll, widgets stack.
- [ ] **Step 7:** Report faithfully what was and was not exercised (e.g. no dev employee with tasks means only unit tests covered the populated Work/Delivery path). Screenshot the populated Overview.

---

## Self-review

- User requirements covered: Approval Activity includes project (Work Management) approvals alongside leave, attendance correction, work-area and location changes; discipline keeps over-break and location violations and gains comparison; insights are grouped as in the reference design; comparison deltas respect which direction is good.
- Type/name consistency: widget selectors/inputs match the tab template and the layout spec; API arguments asserted in specs match Plan 3A's signatures (`getOverviewActivity/Delivery/AttendanceDiscipline` take a trailing `comparePrevious`; `getOverviewWork/Approvals` do not); `EmployeeApprovalItem` fields equal the backend record; `Delta`/`computeDelta` polarity names match Plan 3A.
- Verified by reading source: the committed Plan 2 discipline widget and Overview tab (rewritten verbatim plus the changes), `EmployeePeriodStore`, the two assertion lines in each existing spec. Not compile-checked or run: the executor's first test run is the first compile. Fix compile errors by aligning to real signatures, never by weakening a test.
- Known limits: Approval Activity shows the latest 10 (the rest are counted, noted in the UI); deltas compare against the previous calendar month for a month period; the Work Management card has no comparison; no Work Insight Index (formula undefined).
- Not here: Plan 4 (upcoming items, recent activity, checklists, history events).
