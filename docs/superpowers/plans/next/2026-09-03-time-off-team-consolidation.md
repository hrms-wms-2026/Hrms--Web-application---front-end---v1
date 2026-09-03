# Time Off Team Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Time Off sidebar's three team-facing pages (Team Balances, Pending Approvals, All Requests) into one "Team" page with tabs, fix a permission-gating bug that blocks approve-only/HR-only users from reaching `/time-off` at all, and add legacy-URL redirects — without changing any of the three pages' existing internal behavior.

**Architecture:** A new `TeamHubComponent` (`modules/leave/feature/team-hub/`) owns a tab bar (`shared/ui/tabs`'s `app-tabs`) with up to three tabs — Balances, Pending Approvals, All Requests — each visible only if the signed-in user holds the matching permission. The three existing feature components (`TeamBalancesComponent`, `PendingApprovalsComponent`, `RequestsListComponent`) are reused unmodified except for one new `embedded` boolean input that hides their own page header (kicker/h1/subtitle) when the hub is the one rendering the header instead — this exactly mirrors the `embedded`-mode pattern already shipped in `docs/superpowers/plans/2026-08-26-attendance-team-approvals-consolidation.md` for Attendance's Correction/Work-area approval panels. `TeamHubComponent` picks the active tab from an `app-tabs` `value`/`valueChange` pair backed by a `signal`, not the router — the three child components already self-load their own data in their constructors, so no shared loading state or caching flags are needed (unlike the Attendance case, these three stores are already independent). Legacy URLs `/time-off/team-approvals` and `/time-off/all` become tiny redirect components pointing at `/time-off/team`, matching the `LegacyApprovalRedirectComponent` precedent from the same Attendance plan.

**Tech Stack:** Angular 21 (standalone components, signals, `@ngrx/signals` signalStore), TypeScript, Vitest (`ng test` running the Vitest builder — not Jest/Karma), Angular Router `provideRouter`.

## Global Constraints

- Work only inside `Hrms--Web-application---front-end---v1`. Never touch the backend repository.
- Do not `git add`, `git commit`, or `git push` unless the user asks — leave changes unstaged until told otherwise (this project's own convention per its CLAUDE.md-equivalent skill).
- Permission strings are backend permission codes only, exactly as already used in this codebase: `leave:read-own`, `leave:read-team`, `leave:approve`, `leave:read`, `leave:manage`, `calendar:read`. Never invent a role name or a new permission string.
- `permissionGuard` (`src/app/core/guards/permission.guard.ts`) already treats `route.data['permissions']` as any-of via `PermissionService.hasAnyPermission`. Do not change the guard — only the permission arrays passed to it.
- `HasPermissionDirective` (`src/app/shared/directives/has-permission.directive.ts`, selector `[appHasPermission]`) already exists for per-element permission gating in templates — use it for the tab-list, don't hand-roll a new one.
- Component style budget in this repo: `anyComponentStyle` warns at 4kB, errors at 8kB (`angular.json`). All four touched CSS files are currently 1.2–1.5kB, so there's plenty of room — but keep new hub CSS minimal and reuse `app-tabs`'s own styling rather than re-styling tabs locally.
- Test convention: Vitest (`describe`/`it`/`expect`/`vi` from `'vitest'`), `TestBed` + `provideRouter([...])`, stores mocked as plain objects of `signal()`s and `vi.fn()`s passed via `{ provide: XStore, useValue: store }`. Match this exactly.
- Run a single spec: `npx ng test --no-watch --include "<glob>"`. Run the full suite: `npx ng test --no-watch`. Build: `npm run build`.

---

## Why this ordering

Task 1 fixes a pre-existing permission bug that would otherwise block some of the very users this consolidation is for (approve-only managers, HR-only admins) from ever reaching `/time-off` — fix it first so later manual testing isn't confused by an unrelated outer-gate rejection. Tasks 2–4 add `embedded` mode to the three existing pages independently, each fully testable in isolation before anything embeds them. Task 5 builds the tab hub that composes all three. Task 6 rewires the routes (new hub route + two legacy redirects). Task 7 updates the sidebar nav config to match. Task 8 sweeps the specs that assert the old shape. Task 9 is a full regression run plus a manual QA checklist.

Team Calendar (the "make it look like the main Calendar" part of the original ask) is intentionally **not** in this plan — see the note at the end.

---

### Task 1: Fix the `/time-off` outer route permission gate

**Files:**
- Modify: `src/app/app.routes.ts:66-70`
- Modify: `src/app/app.routes.spec.ts` (new describe block, end of file)

**Context:** `app.routes.ts` gates `path: 'time-off'` itself with `permissionGuard` *before* the lazily-loaded `LEAVE_ROUTES` children are ever reached. Today that outer gate only allows `leave:read-own` (line 68). A manager who only has `leave:read-team`/`leave:approve`, or an HR admin who only has `leave:read`, is rejected right here and redirected to `/dashboard` — they never even reach the inner routes, regardless of what those routes' own `data.permissions` say. This is the exact same class of bug already found and fixed for Attendance in `docs/superpowers/plans/2026-08-26-attendance-team-approvals-consolidation.md` Task 1. Fixing it now matters more once Team Balances/Pending Approvals/All Requests move under one `/time-off/team` route in Task 6 — an approve-only user must be able to reach it.

- [ ] **Step 1: Write the failing test**

Append to the end of `src/app/app.routes.spec.ts` (it already imports `routes` at the top):

```typescript
describe('app routes - Time Off outer gate', () => {
  it('allows leave:read-team, leave:approve, or leave:read to reach /time-off, not just leave:read-own', () => {
    const shell = routes.find((route) => route.path === '' && route.children)!;
    const timeOff = shell.children!.find((route) => route.path === 'time-off')!;

    expect(timeOff.data?.['permissions']).toEqual([
      'leave:read-own',
      'leave:read-team',
      'leave:approve',
      'leave:read',
      'leave:manage',
      'calendar:read'
    ]);
    expect(timeOff.data?.['modules']).toEqual(['leave']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/app.routes.spec.ts"`
Expected: FAIL — production code's `permissions` array is still `['leave:read-own']`, not the 6-permission array.

- [ ] **Step 3: Implement the fix**

In `src/app/app.routes.ts`, change (lines 66-70):

```typescript
      {
        path: 'time-off',
        canActivate: [permissionGuard],
        data: { permissions: ['leave:read-own'], modules: ['leave'] },
        loadChildren: () => import('./modules/leave/leave.routes').then((module) => module.LEAVE_ROUTES)
      },
```

to:

```typescript
      {
        path: 'time-off',
        canActivate: [permissionGuard],
        data: { permissions: ['leave:read-own', 'leave:read-team', 'leave:approve', 'leave:read', 'leave:manage', 'calendar:read'], modules: ['leave'] },
        loadChildren: () => import('./modules/leave/leave.routes').then((module) => module.LEAVE_ROUTES)
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/app.routes.spec.ts"`
Expected: PASS, including the pre-existing "Settings" describe block in the same file (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.spec.ts
git commit -m "fix: allow team/approval-only leave permissions past the /time-off outer route gate"
```

---

### Task 2: `TeamBalancesComponent` — add `embedded` mode

**Files:**
- Modify: `src/app/modules/leave/feature/team-balances/team-balances.component.ts`
- Modify: `src/app/modules/leave/feature/team-balances/team-balances.component.html`
- Create: `src/app/modules/leave/feature/team-balances/team-balances.component.spec.ts` (none exists today)

**Context:** `team-balances.component.html:2` wraps its own `<header class="tbc-header">` with the "TIME OFF / TEAM" kicker and "Team Balances" h1. When this component is embedded inside `TeamHubComponent` (Task 5), that header would duplicate the hub's own page header and the "Team" tab label. Add an `embedded` input that suppresses just that `<header>` element — everything else (search box, table, loading/error/empty states) is unchanged.

- [ ] **Step 1: Write the failing test**

Create `team-balances.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { TeamBalancesComponent } from './team-balances.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';

describe('TeamBalancesComponent', () => {
  async function setup() {
    const store = {
      team: signal([]),
      teamLoading: signal(false),
      teamError: signal<string | null>(null),
      teamFilters: signal({}),
      year: signal(2026),
      loadTeam: vi.fn(),
      setTeamFilters: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TeamBalancesComponent],
      providers: [{ provide: LeaveBalanceStore, useValue: store }]
    }).compileComponents();

    const fixture: ComponentFixture<TeamBalancesComponent> = TestBed.createComponent(TeamBalancesComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('shows its own header by default', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('.tbc-header')).toBeTruthy();
  });

  it('hides its own header when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tbc-header')).toBeNull();
  });

  it('loads the team balances for the current year on init regardless of embedded mode', async () => {
    const { store } = await setup();
    expect(store.loadTeam).toHaveBeenCalledWith(2026);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/team-balances/team-balances.component.spec.ts"`
Expected: the "hides its own header" test fails (`embedded` input doesn't exist yet — `setInput` on an unknown input throws); the other two pass already against current code.

- [ ] **Step 3: Implement**

In `team-balances.component.ts`, add the `input` import and field:

```typescript
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
```

```typescript
export class TeamBalancesComponent {
  readonly store = inject(LeaveBalanceStore);
  readonly embedded = input(false);
  constructor() { void this.store.loadTeam(new Date().getFullYear()); }
  onSearchInput(event: Event): void { const search = (event.target as HTMLInputElement).value; this.store.setTeamFilters({ ...this.store.teamFilters(), search: search || undefined }); }
}
```

In `team-balances.component.html`, wrap the `<header>` element:

```html
<section class="tbc-page">@if (!embedded()) { <header class="tbc-header"><div><p class="tbc-kicker">TIME OFF / TEAM</p><h1>Team Balances</h1><p class="tbc-subtitle">Leave positions for your direct and indirect reports.</p></div><input data-testid="team-balances-search" type="text" placeholder="Search name or employee number" class="tbc-search" (input)="onSearchInput($event)" /></header> }@if (store.teamLoading()) { <div class="tbc-loading" aria-busy="true"><span></span><span></span><span></span></div> } @else if (store.teamError()) { <app-error-state [message]="store.teamError()!" [retryable]="true" (retry)="store.loadTeam(store.year())" /> } @else if (store.team().length === 0) { <app-empty-state title="No team balances found" description="No entitlements match the current filters, or your team has none generated yet." /> } @else { <app-leave-balance-list-table [balances]="store.team()" [showDepartmentColumn]="true" /> }</section>
```

**Note the search input moved inside the `@if` block along with the header** — when embedded, the hub's own tab bar is the only chrome above the table; the search box was cosmetically paired with the header in the original markup and there's no other place for it to live without a design decision this plan doesn't make. If you'd rather keep the search box visible even when embedded, pull it out of the `@if` block into its own always-visible toolbar row before implementing — flag this to the user first, it changes the visual result.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/team-balances/team-balances.component.spec.ts"`
Expected: PASS, all three tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/team-balances/
git commit -m "feat: add embedded mode to TeamBalancesComponent for the Team hub"
```

---

### Task 3: `PendingApprovalsComponent` — add `embedded` mode

**Files:**
- Modify: `src/app/modules/leave/feature/pending-approvals/pending-approvals.component.ts`
- Modify: `src/app/modules/leave/feature/pending-approvals/pending-approvals.component.html:1-4`
- Modify: `src/app/modules/leave/feature/pending-approvals/pending-approvals.component.spec.ts` (already exists — extend it)

- [ ] **Step 1: Write the failing test**

Read the existing `pending-approvals.component.spec.ts` first to match its exact `setup()` helper shape (store mock, providers), then add:

```typescript
  it('shows its own header by default', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('.pa-header')).toBeTruthy();
  });

  it('hides its own header when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pa-header')).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/pending-approvals/pending-approvals.component.spec.ts"`
Expected: the "hides its own header" test fails — `embedded` input doesn't exist yet.

- [ ] **Step 3: Implement**

In `pending-approvals.component.ts`, add the import and field:

```typescript
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
```

```typescript
  readonly embedded = input(false);
```

(Add this field alongside the existing `readonly detailOpen = signal(false);` / `readonly selectedIds = signal<Set<string>>(new Set());` fields — don't change the constructor or any other method.)

In `pending-approvals.component.html`, wrap only the `<header>` block (lines 2-4):

```html
<section class="pa-page">
  @if (!embedded()) {
    <header class="pa-header">
      <div><p class="pa-kicker">TIME OFF / APPROVALS</p><h1>Pending Approvals</h1><p class="pa-subtitle">Requests waiting on your decision.</p></div>
    </header>
  }
  <div class="pa-toolbar">
```

(Everything from `<div class="pa-toolbar">` onward is unchanged — the toolbar, table, and detail sheet stay visible when embedded.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/pending-approvals/pending-approvals.component.spec.ts"`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/pending-approvals/
git commit -m "feat: add embedded mode to PendingApprovalsComponent for the Team hub"
```

---

### Task 4: `RequestsListComponent` — add `embedded` mode

**Files:**
- Modify: `src/app/modules/leave/feature/requests-list/requests-list.component.ts`
- Modify: `src/app/modules/leave/feature/requests-list/requests-list.component.html:1-4`
- Modify: `src/app/modules/leave/feature/requests-list/requests-list.component.spec.ts` (already exists — extend it)

- [ ] **Step 1: Write the failing test**

Read the existing spec's `setup()` helper first, then add:

```typescript
  it('shows its own header by default', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('.rl-header')).toBeTruthy();
  });

  it('hides its own header when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rl-header')).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/requests-list/requests-list.component.spec.ts"`
Expected: the "hides its own header" test fails.

- [ ] **Step 3: Implement**

In `requests-list.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
```

```typescript
  readonly embedded = input(false);
```

In `requests-list.component.html`, wrap only the `<header>` block (lines 2-4):

```html
<section class="rl-page">
  @if (!embedded()) {
    <header class="rl-header">
      <div><p class="rl-kicker">TIME OFF / APPROVALS</p><h1>All Requests</h1><p class="rl-subtitle">Every leave request across the organization.</p></div>
    </header>
  }
  <nav class="rl-filters">
```

(Status filter nav, toolbar, and table stay visible when embedded.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/requests-list/requests-list.component.spec.ts"`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/requests-list/
git commit -m "feat: add embedded mode to RequestsListComponent for the Team hub"
```

---

### Task 5: New `TeamHubComponent`

**Files:**
- Create: `src/app/modules/leave/feature/team-hub/team-hub.component.ts`
- Create: `src/app/modules/leave/feature/team-hub/team-hub.component.html`
- Create: `src/app/modules/leave/feature/team-hub/team-hub.component.css`
- Create: `src/app/modules/leave/feature/team-hub/team-hub.component.spec.ts`

**Interfaces:**
- Consumes: `PermissionService.hasPermission` (`leave:read-team`, `leave:approve`, `leave:read`), `shared/ui/tabs`'s `TabsComponent`/`TabOption`.
- Produces: renders `TeamBalancesComponent` / `PendingApprovalsComponent` / `RequestsListComponent` with `[embedded]="true"`, one at a time, driven by an `activeTab` signal.

**Default tab rule:** default to the first tab the user actually has permission for, in the order Balances → Pending Approvals → All Requests, so a pure-HR user (only `leave:read`, no `leave:read-team`/`leave:approve`) doesn't land on a tab they can't see.

- [ ] **Step 1: Write the failing test**

Create `team-hub.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { TeamHubComponent } from './team-hub.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveApprovalStore } from '../../state/leave-approval.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { signal } from '@angular/core';

describe('TeamHubComponent', () => {
  function emptyStores() {
    return [
      {
        provide: LeaveBalanceStore,
        useValue: {
          team: signal([]), teamLoading: signal(false), teamError: signal(null), teamFilters: signal({}),
          year: signal(2026), loadTeam: vi.fn(), setTeamFilters: vi.fn()
        }
      },
      {
        provide: LeaveApprovalStore,
        useValue: {
          pending: signal([]), pendingLoading: signal(false), pendingError: signal(null), pendingFilter: signal({}),
          all: signal([]), allLoading: signal(false), allError: signal(null), allFilter: signal({}),
          detail: signal(null), deciding: signal(false), decideError: signal(null), cancelDialogError: signal(null),
          loadPending: vi.fn(), setPendingFilter: vi.fn(), loadAll: vi.fn(), setAllFilter: vi.fn(),
          loadDetail: vi.fn(), clearDetail: vi.fn(), approve: vi.fn(), reject: vi.fn(), requestInfo: vi.fn(),
          bulkApprove: vi.fn(), bulkReject: vi.fn(), cancel: vi.fn()
        }
      },
      { provide: LeaveTypeStore, useValue: { items: signal([]), load: vi.fn() } },
      { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
    ];
  }

  async function setup(permissions: readonly string[]) {
    await TestBed.configureTestingModule({
      imports: [TeamHubComponent],
      providers: [
        ...emptyStores(),
        { provide: PermissionService, useValue: { hasPermission: (p: string) => permissions.includes(p) } }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<TeamHubComponent> = TestBed.createComponent(TeamHubComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('shows all three tabs for a user with every team permission', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve', 'leave:read']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab: any) => tab.textContent.trim())).toEqual(['Balances', 'Pending Approvals', 'All Requests']);
  });

  it('shows only the Pending Approvals tab for an approve-only user, and defaults to it', async () => {
    const { fixture } = await setup(['leave:approve']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab: any) => tab.textContent.trim())).toEqual(['Pending Approvals']);
    expect(fixture.nativeElement.querySelector('app-pending-approvals')).toBeTruthy();
  });

  it('defaults to the Balances tab when the user has both read-team and approve', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve']);
    expect(fixture.nativeElement.querySelector('app-team-balances')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-pending-approvals')).toBeNull();
  });

  it('switches to All Requests when that tab is clicked', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve', 'leave:read']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    (Array.from(tabs).find((tab: any) => tab.textContent.trim() === 'All Requests') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-requests-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-team-balances')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/team-hub/team-hub.component.spec.ts"`
Expected: fails to resolve `./team-hub.component` (file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `team-hub.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { TeamBalancesComponent } from '../team-balances/team-balances.component';
import { PendingApprovalsComponent } from '../pending-approvals/pending-approvals.component';
import { RequestsListComponent } from '../requests-list/requests-list.component';

type TeamTab = 'balances' | 'approvals' | 'all';

@Component({
  selector: 'app-team-hub',
  standalone: true,
  imports: [TabsComponent, TeamBalancesComponent, PendingApprovalsComponent, RequestsListComponent],
  templateUrl: './team-hub.component.html',
  styleUrl: './team-hub.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamHubComponent {
  private readonly permissionService = inject(PermissionService);

  private readonly canSeeBalances = computed(() => this.permissionService.hasPermission('leave:read-team'));
  private readonly canSeeApprovals = computed(() => this.permissionService.hasPermission('leave:approve'));
  private readonly canSeeAll = computed(() => this.permissionService.hasPermission('leave:read'));

  readonly tabs = computed<readonly TabOption[]>(() => {
    const options: TabOption[] = [];
    if (this.canSeeBalances()) options.push({ value: 'balances', label: 'Balances' });
    if (this.canSeeApprovals()) options.push({ value: 'approvals', label: 'Pending Approvals' });
    if (this.canSeeAll()) options.push({ value: 'all', label: 'All Requests' });
    return options;
  });

  private readonly requestedTab = signal<TeamTab | null>(null);

  readonly activeTab = computed<TeamTab | null>(() => {
    const requested = this.requestedTab();
    const available = this.tabs().map((tab) => tab.value as TeamTab);
    if (requested && available.includes(requested)) return requested;
    return available[0] ?? null;
  });

  selectTab(tab: string): void {
    this.requestedTab.set(tab as TeamTab);
  }
}
```

Create `team-hub.component.html`:

```html
<section class="team-hub-page">
  <header class="team-hub-header">
    <p class="team-hub-kicker">TIME OFF / TEAM</p>
    <h1>Team</h1>
  </header>

  @if (tabs().length > 1) {
    <app-tabs [tabs]="tabs()" [value]="activeTab() ?? ''" ariaLabel="Team workspace" (valueChange)="selectTab($event)" />
  }

  @switch (activeTab()) {
    @case ('balances') { <app-team-balances [embedded]="true" /> }
    @case ('approvals') { <app-pending-approvals [embedded]="true" /> }
    @case ('all') { <app-requests-list [embedded]="true" /> }
  }
</section>
```

Create `team-hub.component.css`:

```css
.team-hub-page { display: flex; flex-direction: column; gap: 12px; }
.team-hub-header { display: flex; flex-direction: column; gap: 2px; }
.team-hub-kicker { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--color-text-secondary); text-transform: uppercase; margin: 0; }
.team-hub-header h1 { margin: 0; font-size: 20px; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/modules/leave/feature/team-hub/team-hub.component.spec.ts"`
Expected: PASS, all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/team-hub/
git commit -m "feat: add TeamHubComponent tying Team Balances, Pending Approvals, and All Requests into one tabbed page"
```

---

### Task 6: Routes — replace `team`/`team-approvals`/`all` with the hub, add legacy redirects

**Files:**
- Modify: `src/app/modules/leave/leave.routes.ts`
- Modify: `src/app/modules/leave/leave.routes.spec.ts`
- Create: `src/app/modules/leave/feature/legacy-team-redirect/legacy-team-redirect.component.ts`
- Create: `src/app/modules/leave/feature/legacy-team-redirect/legacy-team-redirect.component.spec.ts`

**Context:** `leave.routes.ts` today has separate `team` (`leave:read-team`), `team-approvals` (`leave:approve`), and `all` (`leave:read`) routes. Replace them with one `team` route pointing at `TeamHubComponent`, gated on the union of the three permissions (any-of, matching `permissionGuard`'s existing semantics) so a user with just one of the three can still enter — the hub itself hides tabs they can't use. Keep `team-approvals` and `all` as routes, but point them at a tiny redirect component so old bookmarks/notification deep-links to those URLs still land somewhere sensible instead of 404ing.

- [ ] **Step 1: Write the failing tests**

Replace the two `it`s in `leave.routes.spec.ts` that reference `team` and add new ones for the redirects and the outer array:

```typescript
import { LEAVE_ROUTES } from './leave.routes';
describe('LEAVE_ROUTES', () => {
  it('has My Balances as the permission-protected index route', () => { const index = LEAVE_ROUTES[0].children?.find((route) => route.path === ''); expect(index?.data?.['permissions']).toEqual(['leave:read-own']); });

  it('has a Team route for the consolidated Balances/Approvals/All Requests hub, any-of gated', () => {
    const team = LEAVE_ROUTES[0].children?.find((route) => route.path === 'team');
    expect(team?.data?.['permissions']).toEqual(['leave:read-team', 'leave:approve', 'leave:read']);
  });

  it('has an Entitlements route for HR leave readers and managers', () => { const route = LEAVE_ROUTES[0].children?.find((child) => child.path === 'entitlements'); expect(route?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']); });
  it('retains Leave Types and Leave Policies', () => { const children = LEAVE_ROUTES[0].children ?? []; expect(children.some((route) => route.path === 'types')).toBe(true); expect(children.some((route) => route.path === 'policies')).toBe(true); });

  it('redirects the legacy team-approvals URL to the Team hub, still gated on leave:approve', () => {
    const shell = LEAVE_ROUTES[0];
    const legacy = shell.children?.find((r) => r.path === 'team-approvals');
    expect(legacy?.data?.['permissions']).toEqual(['leave:approve']);
    expect(legacy?.loadComponent).toBeTypeOf('function');
  });

  it('redirects the legacy all URL to the Team hub, still gated on leave:read', () => {
    const shell = LEAVE_ROUTES[0];
    const legacy = shell.children?.find((r) => r.path === 'all');
    expect(legacy?.data?.['permissions']).toEqual(['leave:read']);
    expect(legacy?.loadComponent).toBeTypeOf('function');
  });

  it('has a calendar child route requiring calendar:read', () => {
    const shell = LEAVE_ROUTES[0];
    const calendar = shell.children?.find((r) => r.path === 'calendar');
    expect(calendar?.data?.['permissions']).toEqual(['calendar:read']);
  });
});
```

Create `legacy-team-redirect.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LegacyTeamRedirectComponent } from './legacy-team-redirect.component';

describe('LegacyTeamRedirectComponent', () => {
  it('redirects to the Team hub with replacement navigation', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LegacyTeamRedirectComponent],
      providers: [{ provide: Router, useValue: { navigate } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(LegacyTeamRedirectComponent);
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/time-off/team'], { replaceUrl: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --no-watch --include "src/app/modules/leave/leave.routes.spec.ts" --include "src/app/modules/leave/feature/legacy-team-redirect/legacy-team-redirect.component.spec.ts"`
Expected: the routes spec fails (production still has 3 separate routes, `team`'s permissions are still `['leave:read-team']` only); the redirect component spec fails to resolve the not-yet-created file.

- [ ] **Step 3: Implement**

Create `legacy-team-redirect.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Replaces the pre-consolidation standalone /time-off/team-approvals and
 * /time-off/all pages. Forwards to the canonical Team hub, using replaceUrl
 * so the obsolete URL doesn't remain in browser history.
 */
@Component({
  selector: 'app-legacy-team-redirect',
  standalone: true,
  template: ''
})
export class LegacyTeamRedirectComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigate(['/time-off/team'], { replaceUrl: true });
  }
}
```

In `leave.routes.ts`, replace the whole file with:

```typescript
import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const LEAVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent),
    children: [
      { path: '', loadComponent: () => import('./feature/my-balances/my-balances.component').then((m) => m.MyBalancesComponent), canActivate: [permissionGuard], data: { title: 'My Balances', permissions: ['leave:read-own'] } },
      { path: 'team', loadComponent: () => import('./feature/team-hub/team-hub.component').then((m) => m.TeamHubComponent), canActivate: [permissionGuard], data: { title: 'Team', permissions: ['leave:read-team', 'leave:approve', 'leave:read'] } },
      { path: 'entitlements', loadComponent: () => import('./feature/entitlements-management/entitlements-management.component').then((m) => m.EntitlementsManagementComponent), canActivate: [permissionGuard], data: { title: 'Entitlements', permissions: ['leave:read', 'leave:manage'] } },
      { path: 'types', loadComponent: () => import('./feature/leave-types-management/leave-types-management.component').then((m) => m.LeaveTypesManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Types', permissions: ['leave:read'] } },
      { path: 'policies', loadComponent: () => import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Policies', permissions: ['leave:manage'] } },
      { path: 'team-approvals', loadComponent: () => import('./feature/legacy-team-redirect/legacy-team-redirect.component').then((m) => m.LegacyTeamRedirectComponent), canActivate: [permissionGuard], data: { title: 'Pending Approvals', permissions: ['leave:approve'] } },
      { path: 'all', loadComponent: () => import('./feature/legacy-team-redirect/legacy-team-redirect.component').then((m) => m.LegacyTeamRedirectComponent), canActivate: [permissionGuard], data: { title: 'All Requests', permissions: ['leave:read'] } },
      { path: 'calendar', loadComponent: () => import('./feature/team-calendar/team-calendar.component').then((m) => m.TeamCalendarComponent), canActivate: [permissionGuard], data: { title: 'Team Calendar', permissions: ['calendar:read'] } }
    ]
  }
];
```

(Keeps `permissionGuard` and the exact same `permissions` array on `team-approvals` and `all` as before — only their `loadComponent` target changes, so a user who could reach the old URL can still reach the redirect, then lands on `/time-off/team` where the hub itself decides which tab they see.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --no-watch --include "src/app/modules/leave/leave.routes.spec.ts" --include "src/app/modules/leave/feature/legacy-team-redirect/legacy-team-redirect.component.spec.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/leave.routes.ts src/app/modules/leave/leave.routes.spec.ts src/app/modules/leave/feature/legacy-team-redirect/
git commit -m "feat: route /time-off/team to the Team hub, redirect legacy team-approvals/all URLs"
```

---

### Task 7: Sidebar nav — collapse the three Team entries into one

**Files:**
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts:16-28`
- Modify: `src/app/layouts/main-layout/nav/nav-access.spec.ts` (if it asserts the removed child ids — check before editing)

- [ ] **Step 1: Write the failing test**

Add near the existing Time Off assertion in `nav-access.spec.ts` (around line 83):

```typescript
    it('collapses Team Balances, Pending Approvals, and All Requests into one Team nav entry', () => {
      const timeOff = NAV_ITEMS.find((item) => item.id === 'time-off')!;
      const children = timeOff.children ?? [];
      expect(children.map((child) => child.id)).toEqual([
        'time-off-my-balances',
        'time-off-team',
        'time-off-entitlements',
        'time-off-types',
        'time-off-policies',
        'time-off-calendar'
      ]);

      const team = children.find((child) => child.id === 'time-off-team')!;
      expect(team.path).toBe('/time-off/team');
      expect(team.requiredPermissions).toEqual(['leave:read-team', 'leave:approve', 'leave:read']);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/nav/nav-access.spec.ts"`
Expected: FAIL — production nav config still has 8 children with the old ids.

- [ ] **Step 3: Implement**

In `nav-items.config.ts`, replace the `time-off` item's `children` array (lines 19-26):

```typescript
    children: [
      { id: 'time-off-my-balances', label: 'My Balances', path: '/time-off', exact: true, requiredModules: ['leave'], requiredPermissions: ['leave:read-own'] },
      { id: 'time-off-team', label: 'Team', path: '/time-off/team', requiredModules: ['leave'], requiredPermissions: ['leave:read-team', 'leave:approve', 'leave:read'] },
      { id: 'time-off-entitlements', label: 'Entitlements', path: '/time-off/entitlements', requiredModules: ['leave'], requiredPermissions: ['leave:read', 'leave:manage'] },
      { id: 'time-off-types', label: 'Leave Types', path: '/time-off/types', requiredModules: ['leave'], requiredPermissions: ['leave:read'] },
      { id: 'time-off-policies', label: 'Leave Policies', path: '/time-off/policies', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
      { id: 'time-off-calendar', label: 'Team Calendar', path: '/time-off/calendar', requiredModules: ['leave'], requiredPermissions: ['calendar:read'] }
    ]
```

(This removes `time-off-team-balances`, `time-off-team-approvals`, and `time-off-all-requests`, and adds the single `time-off-team` entry in their place, keeping the same relative position.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/nav/nav-access.spec.ts"`
Expected: PASS, including the pre-existing "grants Time Off on the leave module key" test.

- [ ] **Step 5: Run the broader nav/layout suite for collateral breakage**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/**/*.spec.ts"`
Expected: PASS. If a sidebar-rendering spec (e.g. a `sub-sidebar.component.spec.ts` if one exists) asserts the old 8-item Time Off children list or the removed labels ("Team Balances", "Pending Approvals", "All Requests"), update those assertions the same way — read the failing test's exact expectation before editing, don't guess the shape.

- [ ] **Step 6: Commit**

```bash
git add src/app/layouts/main-layout/nav/
git commit -m "feat: collapse Team Balances/Pending Approvals/All Requests into one Team nav entry"
```

---

### Task 8: Full regression run

- [ ] **Step 1:** Run: `npx ng test --no-watch`
Expected: all green, no regressions outside the files this plan touched.

- [ ] **Step 2:** Run: `npm run build`
Expected: succeeds, no `anyComponentStyle` budget errors.

- [ ] **Step 3: Manual QA checklist** (needs a real login for each role, or three test users)

| User | Expected on `/time-off` | Expected sidebar under Time Off | Expected on `/time-off/team` |
|---|---|---|---|
| Employee only (`leave:read-own`) | My Balances page, as today | My Balances, Entitlements*, Leave Types*, Leave Policies*, Team Calendar (per whatever permissions they separately hold) | Redirected to `/dashboard` (no team permission) |
| Manager (`leave:read-own` + `leave:read-team` + `leave:approve`) | My Balances page | ...+ **Team** | Team hub, defaults to **Balances** tab, both Balances and Pending Approvals tabs visible |
| HR admin (`leave:read`, `leave:manage`, no `leave:read-own`) | **No longer bounced to /dashboard** — lands on My Balances page (empty state is fine) | **Team**, Entitlements, Leave Types, Leave Policies | Team hub, only **All Requests** tab visible, defaults to it |
| Approve-only (`leave:approve` only, nothing else) | No longer bounced to `/dashboard` | **Team** only | Team hub, only **Pending Approvals** tab, defaults to it |

Also manually hit the two legacy URLs (`/time-off/team-approvals`, `/time-off/all`) as a manager and confirm each redirects to `/time-off/team` and the address bar doesn't let Back return to the legacy URL.

- [ ] **Step 4: Report** — once all four rows check out, this consolidation is done. No commit needed for this task (verification only).

---

## Deliberately out of scope: "My Balances" → "My Time Off" relabel

The original ask's symmetry point (My-side vs. Team-side) would read better with the My Balances nav label renamed to "My Time Off" once "Team" exists alongside it. This is a one-line cosmetic change (`nav-items.config.ts`'s `time-off-my-balances` label, plus the `.mbc-header` `<h1>My Balances</h1>` text in `my-balances.component.html:4` if the page heading should match) that's easy to fold into Task 7 or do separately — left out of the numbered tasks above only because it's a product-naming call, not an architectural one. Say the word and it's a two-file edit.

## Deliberately out of scope: Team Calendar visual alignment

The original ask included making Team Calendar (`modules/leave/feature/team-calendar/`) "look like it borrows from the main Calendar." The top-level `/calendar` nav destination is currently still a placeholder (`app.routes.ts:64`, `loadPlaceholder`) with no real design or requirements yet. Building a shared, generic calendar-grid component in `shared/ui/` right now — before a second real consumer exists — would be exactly the kind of premature abstraction this codebase's own architecture guidance warns against (YAGNI: design for the requirement in front of you, not a hypothetical future one).

Recommended alternative for this phase: a lightweight visual pass on `team-calendar.component.css` to bring its spacing/typography/color tokens in line with the rest of the app's shared design tokens (the same CSS custom properties `shared/ui` components already use — `--color-border`, `--color-text-secondary`, `--color-accent`, etc.), without restructuring the component. That's a small, low-risk follow-up task, easy to scope once the main Calendar module actually gets a real design — happy to write it up the same way once you confirm that's the direction, or if you'd rather do the shared-component extraction now anyway, say so and I'll write that task in full instead.
