# Attendance Team Approvals Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two standalone Attendance approval pages (Correction approvals, Work-area approvals) into a new Team → Approvals section of the existing `/attendance/time-tracking` page, fix two permission-gating bugs that currently block approval-only users, add URL-addressable Team/Approvals state, redirect the legacy URLs, and repoint notification deep links — without touching any backend contract.

**Architecture:** `TimeTrackingComponent` grows a `viewMode` (`my`/`team`) and, within `team`, a `teamSection` (`attendance`/`approvals`) and `approvalType` (`corrections`/`work-area`), all derived as `computed()` signals from `ActivatedRoute.queryParamMap` (via `toSignal`) and from two new permission computeds (`hasSelfServiceAccess`, `hasApproveAccess`). Nothing writes back into the derivation chain — user clicks call `router.navigate` directly, so there is no effect loop. `CorrectionApprovalsComponent` and `WorkAreaApprovalsComponent` stop being routed pages (their routes become pure redirects) and become `embedded`-mode panels rendered inside Team → Approvals; because they are conditionally `@if`-rendered inside the *same* `/attendance/time-tracking` route, their existing `ActivatedRoute`-based `requestId` reading keeps working unchanged. A tiny `LegacyApprovalRedirectComponent` replaces the two old feature components at the old routes and forwards to the canonical URL with `replaceUrl: true`.

**Tech Stack:** Angular 21.2 (standalone components, zoneless, signals, `@ngrx/signals` signalStore), TypeScript ~5.9, Vitest (`ng test` running the Vitest builder — see existing `*.spec.ts` files, not Jest/Karma), Angular Router `provideRouter`.

## Global Constraints

- Work only inside `C:\onevoNew\Hrms--Web-application---front-end---v1`. Never touch the backend repository.
- Do not `git add`, `git commit`, or `git push` at any point in this plan. Leave everything unstaged.
- Preserve all pre-existing uncommitted changes already in the working tree (the "My requests" tab consolidation and Work Area hardening reports describe them) — do not revert or reformat anything outside the files this plan touches.
- Permission strings are backend permission codes only, exactly as already used in this codebase: `attendance:read-own`, `attendance:write-own`, `attendance:read`, `attendance:approve`. Never invent `attendance:approval` or any role name.
- `permissionGuard` (`src/app/core/guards/permission.guard.ts`) already treats `route.data['permissions']` as any-of via `PermissionService.hasAnyPermission`. Do not change the guard — only the permission arrays passed to it.
- `time-tracking.component.css` is at 7.8 kB against an 8 kB `anyComponentStyle` build-error budget. Add **zero** new CSS rules to it — reuse the existing `.attendance-view-toggle` / `.attendance-view-toggle__option` and `.my-requests-tablist` / `.my-requests-tab` rule pairs (already comma-shared in the file) for every new tab/toggle control.
- Test convention for this repo: Vitest (`describe`/`it`/`expect`/`vi` from `'vitest'`), `TestBed` + `provideRouter([...])`, store mocked via a plain object of `signal()`s and `vi.fn()`s passed as `{ provide: TimeTrackingStore, useValue: store }`. Match this exactly — do not introduce Jest or `jasmine.createSpy`.
- Run tests with `npx ng test --no-watch --include "<glob>"`; run the full suite with `npx ng test --no-watch`; build with `npm run build`; whitespace-check with `git --no-pager diff --check` (the plain `git diff --check` has hung in this environment before per the prior hardening report — use `--no-pager`).

---

## Why this ordering

Tasks 1–2 fix the two permission bugs and add store plumbing that every later task depends on. Tasks 3–4 convert the two existing approval pages into embeddable panels (independently testable in isolation, before anything embeds them). Task 5 collapses the old standalone routes into redirects. Task 6 builds the URL/permission state machine inside `TimeTrackingComponent`. Task 7 wires that state into the template (Team sub-nav, Approvals tabs, embedding the two panels). Task 8 fixes the notification deep links. Task 9 is full-suite verification and the report.

---

### Task 1: Fix the two permission-gating bugs (outer route gate, time-tracking route, nav config)

**Files:**
- Modify: `src/app/app.routes.ts:66-71` (the `attendance` child route under the authenticated shell)
- Modify: `src/app/app.routes.spec.ts:61-66` (asserts the old 3-permission array)
- Modify: `src/app/modules/attendance/attendance.routes.ts:4-17` (the `time-tracking` route)
- Modify: `src/app/modules/attendance/attendance.routes.spec.ts:9-21` (asserts the old 3-permission array and explicitly asserts `attendance:approve` is absent)
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts:87-109` (Attendance nav children)
- Modify: `src/app/layouts/main-layout/nav/nav-access.spec.ts:104-113` (real-config Attendance test)

**Context — why both routes matter:** `app.routes.ts` gates `path: 'attendance'` itself with `permissionGuard` before the lazy-loaded `ATTENDANCE_ROUTES` children are ever reached. Today that outer gate only allows `attendance:read-own`, `attendance:write-own`, `attendance:read` — an `attendance:approve`-only user is rejected here and never even reaches `attendance.routes.ts`. Fixing the inner route alone is not sufficient.

- [ ] **Step 1: Write the failing tests**

In `src/app/app.routes.spec.ts`, replace the existing permission assertion (lines ~61-66) with:

```typescript
    expect(attendance?.data?.['permissions']).toEqual([
      'attendance:read-own',
      'attendance:write-own',
      'attendance:read',
      'attendance:approve'
    ]);
```

In `src/app/modules/attendance/attendance.routes.spec.ts`, replace the first `it` block (lines 9-21) with:

```typescript
  it('guards time tracking with time_attendance and the established any-of permission set, including attendance:approve', () => {
    const route = timeTracking();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual([
      'attendance:read-own',
      'attendance:write-own',
      'attendance:read',
      'attendance:approve'
    ]);
    expect(route.data?.['roles']).toBeUndefined();
  });
```

In `src/app/layouts/main-layout/nav/nav-access.spec.ts`, add a new assertion inside the existing `'gates Attendance on time_attendance and a self-service or read permission'` test (after line 111), and rename the test to reflect the new behavior:

```typescript
    it('gates Attendance on time_attendance and any of self-service, read, or approve — and keeps Time Tracking reachable for an approve-only user', () => {
      const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance')!;

      expect(attendance.path).toBe('/attendance/time-tracking');
      expect(canAccessNavItem(attendance, checker(['attendance:read-own'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:write-own'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:read'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker(['attendance:approve'], ['time_attendance']))).toBe(true);
      expect(canAccessNavItem(attendance, checker([], ['time_attendance']))).toBe(false);
      expect(canAccessNavItem(attendance, checker(['attendance:read-own'], []))).toBe(false);

      const children = attendance.children ?? [];
      expect(children.map((child) => child.id)).toEqual(['time-attendance-tracking']);
      const tracking = children[0];
      expect(canAccessNavItem(tracking, checker(['attendance:approve'], ['time_attendance']))).toBe(true);
    });
```

(This replaces the old `it('gates Attendance on time_attendance and a self-service or read permission', ...)` block — same file/location, new name and body.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --no-watch --include "src/app/app.routes.spec.ts" --include "src/app/modules/attendance/attendance.routes.spec.ts" --include "src/app/layouts/main-layout/nav/nav-access.spec.ts"`
Expected: 3 failures — the two route specs expect the 4-permission array but production code still returns 3; the nav-access spec expects `attendance:approve` to unlock the `time-attendance-tracking` child but that child doesn't list it yet.

- [ ] **Step 3: Implement the fix**

In `src/app/app.routes.ts`, change (around line 68-71):

```typescript
        data: {
          permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read'],
          modules: ['time_attendance']
        },
```

to:

```typescript
        data: {
          permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
          modules: ['time_attendance']
        },
```

In `src/app/modules/attendance/attendance.routes.ts`, change the `time-tracking` route's `data.permissions` (line 10) from:

```typescript
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read'],
```

to:

```typescript
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
```

In `src/app/layouts/main-layout/nav/nav-items.config.ts`, replace the `time-attendance` item's `children` array (lines 87-109) with:

```typescript
    children: [
      {
        id: 'time-attendance-tracking',
        label: 'Time Tracking',
        path: '/attendance/time-tracking',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve']
      }
    ]
```

(This removes the `time-attendance-correction-approvals` and `time-attendance-work-area-approvals` entries entirely and adds `attendance:approve` to the surviving `time-attendance-tracking` entry. The parent's own `requiredPermissions` at line 86 already includes `attendance:approve` — leave it unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --no-watch --include "src/app/app.routes.spec.ts" --include "src/app/modules/attendance/attendance.routes.spec.ts" --include "src/app/layouts/main-layout/nav/nav-access.spec.ts"`
Expected: all pass.

- [ ] **Step 5: Run the broader route/nav suite to check for collateral breakage**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/**/*.spec.ts"`
Expected: pass. If `side-navbar.component.spec.ts` or `sub-sidebar.component.spec.ts` assert the old 3-item Attendance children list or the two removed labels ("Correction approvals", "Work-area approvals"), update those assertions the same way (remove the two entries, keep only "Time Tracking"). Read the failing test's exact expectation before editing — do not guess the assertion shape.

---

### Task 2: Store — add `approvalInboxLoaded` / `workAreaApprovalInboxLoaded` flags

**Files:**
- Modify: `src/app/modules/attendance/state/time-tracking.store.ts`
- Modify: `src/app/modules/attendance/state/time-tracking.store.spec.ts`

**Context:** Mirrors the existing `myCorrectionsLoaded` / `myWorkAreaRequestsLoaded` precedent (see `TIME_TRACKING_FRONTEND_MY_REQUESTS_CONSOLIDATION_REPORT.md`). These flags let the embedded approval panels (Tasks 3-4) skip a redundant fetch when re-activated after already loading once, while the "Try again" retry button keeps calling the unconditional loader directly.

- [ ] **Step 1: Write the failing tests**

Add to `time-tracking.store.spec.ts` (follow the existing `myCorrectionsLoaded` test pattern in the same file):

```typescript
  it('sets approvalInboxLoaded to true only after a successful loadApprovalInbox', async () => {
    apiMock.getApprovalInbox.mockReturnValue(of([]));
    expect(store.approvalInboxLoaded()).toBe(false);
    await store.loadApprovalInbox();
    expect(store.approvalInboxLoaded()).toBe(true);
  });

  it('does not set approvalInboxLoaded after a failed loadApprovalInbox', async () => {
    apiMock.getApprovalInbox.mockReturnValue(throwError(() => new Error('network')));
    await store.loadApprovalInbox();
    expect(store.approvalInboxLoaded()).toBe(false);
  });

  it('sets workAreaApprovalInboxLoaded to true only after a successful loadWorkAreaApprovalInbox', async () => {
    apiMock.getWorkAreaChangeApprovalInbox.mockReturnValue(of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }));
    expect(store.workAreaApprovalInboxLoaded()).toBe(false);
    await store.loadWorkAreaApprovalInbox();
    expect(store.workAreaApprovalInboxLoaded()).toBe(true);
  });

  it('does not set workAreaApprovalInboxLoaded after a failed loadWorkAreaApprovalInbox', async () => {
    apiMock.getWorkAreaChangeApprovalInbox.mockReturnValue(throwError(() => new Error('network')));
    await store.loadWorkAreaApprovalInbox();
    expect(store.workAreaApprovalInboxLoaded()).toBe(false);
  });
```

Check the existing top of the file for the exact `apiMock`/`TestBed` setup shape (mirrors `time-tracking.component.spec.ts`'s pattern but for the store) and place these `it`s in the corresponding `describe` blocks (approval inbox tests near `loadApprovalInbox`, work-area near `loadWorkAreaApprovalInbox`).

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/state/time-tracking.store.spec.ts"`
Expected: 4 new failures — `approvalInboxLoaded`/`workAreaApprovalInboxLoaded` don't exist on the store yet (`TypeError`).

- [ ] **Step 3: Implement**

In `time-tracking.store.ts`:

Add two fields to `TimeTrackingState` (near `approvalInbox`/`workAreaApprovalInbox`, lines ~80 and ~99):

```typescript
  readonly approvalInboxLoaded: boolean;
```
```typescript
  readonly workAreaApprovalInboxLoaded: boolean;
```

Add to `initialState` (near lines 140 and 159):

```typescript
  approvalInboxLoaded: false,
```
```typescript
  workAreaApprovalInboxLoaded: false,
```

In `loadApprovalInbox` (around line 320-329), set the flag on success only:

```typescript
      async loadApprovalInbox(): Promise<void> {
        if (store.approvalInboxLoading()) return;
        patchState(store, { approvalInboxLoading: true, approvalInboxError: null });
        try {
          const approvalInbox = await firstValueFrom(api.getApprovalInbox('pending'));
          patchState(store, { approvalInbox, approvalInboxLoading: false, approvalInboxError: null, approvalInboxLoaded: true });
        } catch (error) {
          patchState(store, { approvalInboxLoading: false, approvalInboxError: errors.toSafeMessage(error, CORRECTIONS_APPROVAL_LOAD_ERROR) });
        }
      },
```

In `loadWorkAreaApprovalInbox` (around line 405-433), add `workAreaApprovalInboxLoaded: true` to the success `patchState` call only (do not add it to the catch branch):

```typescript
          patchState(store, {
            workAreaApprovalInbox: result.items,
            workAreaApprovalInboxPage: result.pageNumber,
            workAreaApprovalInboxPageSize: result.pageSize,
            workAreaApprovalInboxTotalCount: result.totalCount,
            workAreaApprovalInboxLoading: false,
            workAreaApprovalInboxError: null,
            workAreaApprovalInboxLoaded: true,
            workAreaApprovalFilters: { ...requestQuery, pageNumber: result.pageNumber, pageSize: result.pageSize }
          });
```

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/state/time-tracking.store.spec.ts"`
Expected: pass, including all pre-existing tests in the file (no regressions).

---

### Task 3: `CorrectionApprovalsComponent` — add `embedded` mode and cache-aware initial load

**Files:**
- Modify: `src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.ts`
- Modify: `src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.html`
- Modify: `src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.spec.ts`

**Interfaces:**
- Produces: `embedded = input(false)` (boolean signal input) — Task 7 sets `[embedded]="true"` when rendering this component inside `TimeTrackingComponent`.
- Consumes: `store.approvalInboxLoaded` from Task 2.

- [ ] **Step 1: Write the failing tests**

Add to `correction-approvals.component.spec.ts` (the `setup()` helper needs `approvalInboxLoaded: signal(false)` added to the mocked `store` object, and `loadApprovalInbox` should stay a `vi.fn(() => Promise.resolve())` — it does not itself flip the flag since it's a mock):

```typescript
  it('hides the breadcrumb and page heading when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('#approvals-heading')).toBeNull();
  });

  it('still shows the breadcrumb and heading when not embedded', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#approvals-heading')?.textContent).toContain('Attendance correction approvals');
  });

  it('does not re-fetch the inbox on init when the store already has a loaded inbox', async () => {
    const { store } = await setup();
    store.approvalInboxLoaded.set(true);
    // simulate a fresh mount against the same (mocked) store, as happens when the parent re-shows this tab
    await TestBed.resetTestingModule();
    const store2 = {
      approvalInbox: signal([pending]), approvalInboxLoading: signal(false), approvalInboxError: signal<string | null>(null),
      approvalInboxLoaded: signal(true),
      correctionActionLoading: signal(false), activeCorrectionAction: signal<string | null>(null),
      loadApprovalInbox: vi.fn(() => Promise.resolve()),
      approveCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'approved' })),
      rejectCorrection: vi.fn(() => Promise.resolve({ ...pending, status: 'rejected' }))
    };
    await TestBed.configureTestingModule({
      imports: [CorrectionApprovalsComponent],
      providers: [provideRouter([]), { provide: TimeTrackingStore, useValue: store2 }, { provide: NotificationService, useValue: { success: vi.fn() } }]
    }).compileComponents();
    const fixture2 = TestBed.createComponent(CorrectionApprovalsComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(store2.loadApprovalInbox).not.toHaveBeenCalled();
    expect((fixture2.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('still fetches on init when the store has no loaded inbox yet', async () => {
    const { store } = await setup();
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(1);
  });
```

Also add `approvalInboxLoaded: signal(false)` to the existing `setup()`'s `store` object literal (so the current tests keep compiling and passing — every current test exercises the "not yet loaded" path, which must remain unconditional-load behavior).

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.spec.ts"`
Expected: compile error (`store.approvalInboxLoaded` missing on the mock type is fine once you add it to `setup()`, but the embedded-mode tests fail because `embedded` input and the conditional markup don't exist yet; the "does not re-fetch" test fails because `ngOnInit` currently always calls `load()`).

- [ ] **Step 3: Implement**

In `correction-approvals.component.ts`:

Add the `input` import and field:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
```

```typescript
  readonly embedded = input(false);
```

Replace `ngOnInit` and extract the deep-link-matching logic out of `load()` so it can run against already-loaded data without a new fetch:

```typescript
  ngOnInit(): void {
    this.requestedId.set(this.route.snapshot.queryParamMap.get('requestId'));
    if (this.store.approvalInboxLoaded()) {
      this.tryOpenDeepLink();
    } else {
      void this.load();
    }
  }

  async load(): Promise<void> {
    await this.store.loadApprovalInbox();
    this.tryOpenDeepLink();
  }

  private tryOpenDeepLink(): void {
    const id = this.requestedId();
    if (!id) return;
    const match = this.store.approvalInbox().find((request) => request.id === id && request.status === 'pending');
    if (!match) {
      this.reviewError.set('This request is no longer pending or could not be found. Refresh the list to see the latest requests.');
      return;
    }
    setTimeout(() => document.querySelector(`[data-request-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
  }
```

(This removes the old body of `load()` and moves it into `tryOpenDeepLink()`; `load()` now just awaits the fetch and delegates. The `<app-button (pressed)="load()">Try again</app-button>` retry button in the template is unchanged and keeps calling `load()`, which always re-fetches — matching the "retry bypasses dedup" precedent from the My-requests consolidation.)

In `correction-approvals.component.html`, wrap the header and the `section-heading` block in `@if (!embedded())`:

```html
<div class="approvals-page">
  @if (!embedded()) {
    <header class="approvals-header"><app-breadcrumb-header parentLabel="Attendance" currentLabel="Correction approvals" icon="time-attendance" /></header>
  }
  <section class="approvals-card" aria-labelledby="approvals-heading">
    @if (!embedded()) {
      <div class="section-heading"><div><p class="eyebrow">Review queue</p><h1 id="approvals-heading">Attendance correction approvals</h1></div><span class="queue-count">{{ store.approvalInbox().length }} pending</span></div>
    }
    @if (reviewError()) { <p class="stale-message" role="status">{{ reviewError() }}</p> }
```

(Everything after this point in the file — loading/error/empty states, the approval list, the review modal — is unchanged. Only the two blocks above move behind `@if (!embedded())`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.spec.ts"`
Expected: all pass, including the pre-existing 6 tests from before this task.

---

### Task 4: `WorkAreaApprovalsComponent` — add `embedded` mode and cache-aware initial load

**Files:**
- Modify: `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.ts`
- Modify: `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.html`
- Modify: `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts`

**Interfaces:**
- Produces: `embedded = input(false)`.
- Consumes: `store.workAreaApprovalInboxLoaded` from Task 2.

- [ ] **Step 1: Write the failing tests**

Add `workAreaApprovalInboxLoaded: signal(false)` to the `ApprovalStoreMock` interface and to the `setup()` store object literal in `work-area-approvals.component.spec.ts` (so all existing tests, which exercise the not-yet-loaded path, keep passing unchanged).

Add:

```typescript
  it('hides the breadcrumb and page heading when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('#work-area-approvals-heading')).toBeNull();
  });

  it('still shows the breadcrumb and heading when not embedded', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
  });

  it('does not re-fetch the inbox on init when the store already has a loaded inbox', async () => {
    const store: ApprovalStoreMock = {
      workAreaApprovalInbox: signal([pending]),
      workAreaApprovalInboxLoading: signal(false),
      workAreaApprovalInboxError: signal(null),
      workAreaApprovalInboxPage: signal(1),
      workAreaApprovalInboxPageSize: signal(20),
      workAreaApprovalInboxTotalCount: signal(1),
      workAreaApprovalInboxLoaded: signal(true),
      workAreaActionLoading: signal(false),
      loadWorkAreaApprovalInbox: vi.fn(() => Promise.resolve()),
      selectWorkAreaApprovalRequest: vi.fn(),
      approveWorkAreaChangeRequest: vi.fn(),
      rejectWorkAreaChangeRequest: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [WorkAreaApprovalsComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkAreaApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(store.loadWorkAreaApprovalInbox).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('still fetches on init when the store has no loaded inbox yet', async () => {
    const { store } = await setup();
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts"`
Expected: same category of failures as Task 3 Step 2.

- [ ] **Step 3: Implement**

In `work-area-approvals.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
```

```typescript
  readonly embedded = input(false);
```

Replace `ngOnInit`/`load` the same way as Task 3, extracting the deep-link/match logic:

```typescript
  ngOnInit(): void {
    this.requestedId.set(this.route.snapshot.queryParamMap.get('requestId'));
    if (this.store.workAreaApprovalInboxLoaded()) {
      this.tryOpenDeepLink();
    } else {
      void this.load();
    }
  }

  async load(): Promise<void> {
    this.pageMessage.set('');
    await this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 1 });
    this.tryOpenDeepLink();
  }

  private tryOpenDeepLink(): void {
    const id = this.requestedId();
    if (!id) return;
    const match = this.store.workAreaApprovalInbox().find((request) => request.id === id && request.status === 'pending');
    if (match) {
      this.openReview(match);
      setTimeout(() => {
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-request-id]'))
          .find((element) => element.dataset['requestId'] === id);
        row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    this.pageMessage.set('Open the pending requests list to review this request.');
  }
```

In `work-area-approvals.component.html`, wrap the header and section-heading block:

```html
<div class="work-area-approvals-page">
  @if (!embedded()) {
    <header class="work-area-approvals-header">
      <app-breadcrumb-header parentLabel="Attendance" currentLabel="Work-area approvals" icon="time-attendance" />
    </header>
  }

  <section class="approval-card" aria-labelledby="work-area-approvals-heading">
    @if (!embedded()) {
      <div class="section-heading">
        <div>
          <p class="eyebrow">Approval inbox</p>
          <h1 id="work-area-approvals-heading">Work-area approvals</h1>
        </div>
        <span class="access-note">{{ store.workAreaApprovalInboxTotalCount() }} pending</span>
      </div>
    }
```

(Rest of the file unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts"`
Expected: all pass, including the pre-existing tests.

---

### Task 5: Legacy redirect component + collapse the two standalone approval routes

**Files:**
- Create: `src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.ts`
- Create: `src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.spec.ts`
- Modify: `src/app/modules/attendance/attendance.routes.ts`
- Modify: `src/app/modules/attendance/attendance.routes.spec.ts`

**Interfaces:**
- Consumes: `route.snapshot.data['approvalType']` (`'corrections' | 'work-area'`), `route.snapshot.queryParamMap.get('requestId')`.
- Produces: navigates to `/attendance/time-tracking` with `queryParams: { view: 'team', section: 'approvals', type, requestId }` and `replaceUrl: true`.

- [ ] **Step 1: Write the failing test**

Create `legacy-approval-redirect.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LegacyApprovalRedirectComponent } from './legacy-approval-redirect.component';

describe('LegacyApprovalRedirectComponent', () => {
  async function setup(approvalType: 'corrections' | 'work-area', requestId: string | null) {
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LegacyApprovalRedirectComponent],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { approvalType }, queryParamMap: { get: (key: string) => (key === 'requestId' ? requestId : null) } } } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(LegacyApprovalRedirectComponent);
    fixture.detectChanges();
    return { navigate };
  }

  it('redirects the legacy correction-approvals URL to the canonical Team/Approvals/corrections URL, preserving requestId, with replacement navigation', async () => {
    const { navigate } = await setup('corrections', 'c1');
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', section: 'approvals', type: 'corrections', requestId: 'c1' }, replaceUrl: true }
    );
  });

  it('redirects the legacy work-area-approvals URL to the canonical Team/Approvals/work-area URL, preserving requestId, with replacement navigation', async () => {
    const { navigate } = await setup('work-area', 'wa-1');
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', section: 'approvals', type: 'work-area', requestId: 'wa-1' }, replaceUrl: true }
    );
  });

  it('redirects without a requestId when none is present', async () => {
    const { navigate } = await setup('corrections', null);
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', section: 'approvals', type: 'corrections', requestId: null }, replaceUrl: true }
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.spec.ts"`
Expected: fails to resolve `./legacy-approval-redirect.component` (file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `legacy-approval-redirect.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Replaces the pre-consolidation standalone approval pages at the old URLs.
 * Forwards to the canonical Team > Approvals workspace inside Time Tracking,
 * preserving requestId, using replaceUrl so the obsolete URL doesn't remain
 * in browser history.
 */
@Component({
  selector: 'app-legacy-approval-redirect',
  standalone: true,
  template: ''
})
export class LegacyApprovalRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const approvalType = this.route.snapshot.data['approvalType'] as 'corrections' | 'work-area';
    const requestId = this.route.snapshot.queryParamMap.get('requestId');
    void this.router.navigate(['/attendance/time-tracking'], {
      queryParams: { view: 'team', section: 'approvals', type: approvalType, requestId },
      replaceUrl: true
    });
  }
}
```

In `attendance.routes.ts`, replace the `corrections/approvals` and `work-area-change-requests/approvals` route entries (lines 18-35) with:

```typescript
  {
    path: 'corrections/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Attendance correction approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'corrections' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
  {
    path: 'work-area-change-requests/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Work-area approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'work-area' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
```

(Keep `permissionGuard` and the same `permissions`/`modules` data exactly as before — only the `loadComponent` target changes, plus the new `approvalType` data key.)

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.spec.ts"`
Expected: pass.

- [ ] **Step 5: Update `attendance.routes.spec.ts` for the new redirect shape**

Replace the `it`s that reference `CorrectionApprovalsComponent`/`WorkAreaApprovalsComponent` loading directly (lines 23-40) with assertions against the redirect component and `approvalType` data, and update the "keeps the protected destination lazy-loaded" test (lines 42-55) — it already only checks `loadComponent` is a function and `canActivate` includes `permissionGuard`, both still true, but add an explicit no-redirect-loop check:

```typescript
  it('routes correction approvals through the legacy redirect with time_attendance and attendance:approve only', () => {
    const route = approvals();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual(['attendance:approve']);
    expect(route.data?.['approvalType']).toBe('corrections');
    expect(route.data?.['roles']).toBeUndefined();
    expect(route.loadComponent).toBeTypeOf('function');
  });

  it('routes Work Area approvals through the legacy redirect with time_attendance and attendance:approve only', () => {
    const route = workAreaApprovals();

    expect(route.canActivate).toContain(permissionGuard);
    expect(route.data?.['modules']).toEqual(['time_attendance']);
    expect(route.data?.['permissions']).toEqual(['attendance:approve']);
    expect(route.data?.['approvalType']).toBe('work-area');
    expect(route.data?.['roles']).toBeUndefined();
    expect(route.loadComponent).toBeTypeOf('function');
  });
```

Run: `npx ng test --no-watch --include "src/app/modules/attendance/attendance.routes.spec.ts"`
Expected: pass.

---

### Task 6: `TimeTrackingComponent` — permission computeds and URL-derived Team/Approvals state

**Files:**
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts`

**Context:** This task changes only the component class (logic), not the template — Task 7 wires the template. Keep the existing signal/computed *names* `viewMode`, `canShowTeamView`, and `selectViewMode` (now backed by different logic) so Task 7's template diff against the current `.html` stays minimal; the current template already calls these by name.

**Interfaces:**
- Produces: `hasSelfServiceAccess`, `hasApproveAccess`, `viewMode` (now `computed`), `teamSection`, `approvalType`, `selectTeamSection(section)`, `selectApprovalType(type)`, `approvalBadgeCorrections`, `approvalBadgeWorkArea`.
- Consumes: `PermissionService.hasAnyPermission`/`hasPermission` (existing), `ActivatedRoute.queryParamMap` (new), `Router.navigate` (new), `TimeTrackingStore.approvalInboxLoaded`/`workAreaApprovalInboxLoaded` (Task 2).

- [ ] **Step 1: Write the failing tests**

The existing `time-tracking.component.spec.ts` `setup()` helper (lines 140-208) needs three additions to its `store` mock object and one to its `providers` array:

```typescript
      approvalInbox: signal<readonly { id: string; status: string }[]>([]),
      approvalInboxLoaded: signal(false),
      workAreaApprovalInboxTotalCount: signal(0),
      workAreaApprovalInboxLoaded: signal(false),
```

and change the `PermissionService` provider from `{ hasPermission: vi.fn(() => access) }` to a version where individual permissions can be controlled per test — add an optional `permissions: string[]` parameter to `setup()`:

```typescript
  async function setup(
    overrides: Partial<AttendanceTodayResponse> = {},
    access = false,
    history: readonly AttendanceHistoryRow[] = [],
    corrections: readonly AttendanceCorrectionResponse[] = [],
    workAreaRequests: readonly WorkAreaChangeRequestResponse[] = [],
    loadedFlags: { corrections?: boolean; workArea?: boolean } = {},
    permissions: string[] = ['attendance:read-own', 'attendance:write-own']
  ): Promise<{ fixture: ComponentFixture<TimeTrackingComponent>; store: StoreMock }> {
    // ...unchanged store object construction, but the two new signals above added...
    await TestBed.configureTestingModule({
      imports: [TimeTrackingComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: vi.fn((permission: string) => permission === 'attendance:read' ? access : permissions.includes(permission)),
            hasAnyPermission: vi.fn((required: string[]) => required.some((p) => permissions.includes(p)))
          }
        }
      ]
    }).compileComponents();
    // ...unchanged...
```

(This keeps the existing `access` boolean parameter meaning "has `attendance:read`" for every existing call site, since every existing test calls `setup(overrides, access, ...)` positionally and none pass the new `permissions` argument — the default `['attendance:read-own', 'attendance:write-own']` preserves current self-service-only behavior for all pre-existing tests.)

Add new tests:

```typescript
  it('resolves viewMode to team by default for an approve-only user with no self-service permission', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    expect(fixture.componentInstance.viewMode()).toBe('team');
    expect(fixture.componentInstance.teamSection()).toBe('approvals');
  });

  it('does not call loadToday, loadMyHistory, or ensureRequestTabLoaded for an approve-only user', async () => {
    const { store } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    expect(store.loadToday).not.toHaveBeenCalled();
    expect(store.loadMyHistory).not.toHaveBeenCalled();
    expect(store.loadMyCorrections).not.toHaveBeenCalled();
  });

  it('shows Team attendance but not Approvals for a read-only user', async () => {
    const { fixture, store } = await setup({}, true, [], [], [], {}, ['attendance:read-own']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(true);
    expect(fixture.componentInstance.hasApproveAccess()).toBe(false);
    fixture.componentInstance.selectViewMode('team');
    expect(store.loadToday).toHaveBeenCalled();
  });

  it('shows Approvals but not Team attendance for an approve-only user', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(true);
    expect(fixture.componentInstance.hasApproveAccess()).toBe(true);
    expect(fixture.componentInstance.hasCoveredAccess()).toBe(false);
  });

  it('a self-service-only user cannot reach team view', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:read-own']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(false);
    expect(fixture.componentInstance.viewMode()).toBe('my');
  });

  it('does not depend on Today.canViewCoveredEmployees for approval visibility', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: false }, false, [], [], [], {}, ['attendance:approve']);
    expect(fixture.componentInstance.hasApproveAccess()).toBe(true);
    expect(fixture.componentInstance.teamSection()).toBe('approvals');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts"`
Expected: many failures — `teamSection`, `hasApproveAccess`, `hasCoveredAccess` (as a public computed; currently private-ish naming differs), `canShowTeamView()` semantics, and the gated-loads tests all fail against current production code.

- [ ] **Step 3: Implement**

In `time-tracking.component.ts`, add imports:

```typescript
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
```

Replace the `viewMode` field and the permission/team computeds (current lines 44-58) with:

```typescript
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Math = Math;
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly hasSelfServiceAccess = computed(() => this.permissionService.hasAnyPermission(['attendance:read-own', 'attendance:write-own']));
  readonly hasCoveredAccess = computed(() => this.permissionService.hasPermission('attendance:read'));
  readonly hasApproveAccess = computed(() => this.permissionService.hasPermission('attendance:approve'));
  readonly canShowTeamView = computed(() => this.hasCoveredAccess() || this.hasApproveAccess());

  readonly viewMode = computed<AttendanceViewMode>(() => {
    const requested = this.queryParams().get('view');
    if (requested === 'team' && this.canShowTeamView()) return 'team';
    if (requested === 'my' && this.hasSelfServiceAccess()) return 'my';
    if (this.hasSelfServiceAccess()) return 'my';
    if (this.canShowTeamView()) return 'team';
    return 'my';
  });

  readonly teamSection = computed<'attendance' | 'approvals'>(() => {
    const requested = this.queryParams().get('section');
    if (requested === 'approvals' && this.hasApproveAccess()) return 'approvals';
    if (requested === 'attendance' && this.hasCoveredAccess()) return 'attendance';
    return this.hasCoveredAccess() ? 'attendance' : 'approvals';
  });

  readonly approvalType = computed<'corrections' | 'work-area'>(() =>
    this.queryParams().get('type') === 'work-area' ? 'work-area' : 'corrections'
  );

  readonly deepLinkRequestId = computed(() => this.queryParams().get('requestId'));
  readonly approvalBadgeCorrections = computed(() => this.store.approvalInbox().length);
  readonly approvalBadgeWorkArea = computed(() => this.store.workAreaApprovalInboxTotalCount());

  readonly selectedRequestTab = signal<PersonalRequestTab>('corrections');
```

(Delete the old `readonly viewMode = signal<AttendanceViewMode>('my');` and old `readonly hasCoveredAccess = computed(...)` / `readonly canShowTeamView = computed(...)` lines — they're superseded by the block above. Keep `readonly canViewCoveredEmployees` and `readonly friendlyTodayMessages` etc. as they are; `canViewCoveredEmployees` still exists unchanged and continues to gate the Team-attendance *empty state*, not visibility.)

Add a constructor with the team-data-loading effect (place after all field declarations, before `ngOnInit`):

```typescript
  constructor() {
    effect(() => {
      if (this.viewMode() !== 'team') return;
      const section = this.teamSection();
      if (section === 'attendance') {
        if (this.hasCoveredAccess()) {
          const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
          void this.store.loadCoveredHistory(range);
        }
        return;
      }
      if (this.hasApproveAccess()) {
        if (this.approvalType() === 'corrections' && !this.store.approvalInboxLoaded()) {
          void this.store.loadApprovalInbox();
        }
        if (this.approvalType() === 'work-area' && !this.store.workAreaApprovalInboxLoaded()) {
          void this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 1 });
        }
      }
    });
  }
```

Replace `ngOnInit` (current lines 85-92):

```typescript
  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday();
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
      this.ensureRequestTabLoaded(this.selectedRequestTab());
    }
  }
```

Replace `selectViewMode` (current lines 128-142) with navigation-based versions, and add the two new selector methods:

```typescript
  selectViewMode(mode: AttendanceViewMode): void {
    if (mode === 'my') {
      this.navigateState({ view: null, section: null, type: null, requestId: null });
      return;
    }
    const section = this.hasCoveredAccess() ? 'attendance' : 'approvals';
    this.navigateState({ view: 'team', section, type: section === 'approvals' ? this.approvalType() : null, requestId: null });
  }

  selectTeamSection(section: 'attendance' | 'approvals'): void {
    this.navigateState({ view: 'team', section, type: section === 'approvals' ? this.approvalType() : null, requestId: null });
  }

  selectApprovalType(type: 'corrections' | 'work-area'): void {
    this.navigateState({ view: 'team', section: 'approvals', type, requestId: null });
  }

  private navigateState(params: { view: string | null; section: string | null; type: string | null; requestId: string | null }): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }
```

(Delete the old body of `selectViewMode` that called `this.viewMode.set(mode)` / `this.store.loadCoveredHistory` / `this.store.loadMyHistory` directly — the constructor effect above now owns triggering `loadCoveredHistory` reactively whenever `viewMode`/`teamSection` change, and `loadMyHistory` for the `my` case is unaffected since `onRangeSelected`/`loadForCurrentView` already handle it. Leave `onRangeSelected` and `loadForCurrentView` as they are, but change `loadForCurrentView`'s `if (this.viewMode() === 'team')` branch to also check `this.teamSection() === 'attendance'`:)

```typescript
  private loadForCurrentView(range: TimeTrackingRange): void {
    if (this.viewMode() === 'team' && this.teamSection() === 'attendance') {
      if (this.hasCoveredAccess()) {
        void this.store.loadCoveredHistory(range);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts"`
Expected: new tests pass. Some pre-existing tests will now fail to *compile* against the template (Task 7 hasn't run yet) if the template still references removed signals — it doesn't; `viewMode()`, `selectViewMode()`, `canShowTeamView()` all still exist with the same call signatures, so the current template should still compile and its existing assertions should still pass unchanged. If any pre-existing test fails, read its exact expectation before adjusting it — do not weaken an assertion to make it pass.

---

### Task 7: `TimeTrackingComponent` template — Team sub-nav, Approvals tabs, embed the two panels

**Files:**
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` (import the two panel components)
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `time-tracking.component.spec.ts`:

```typescript
  it('renders the Team sub-nav as accessible tabs and shows only the permitted sections', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    fixture.detectChanges();
    const tablist = fixture.nativeElement.querySelector('[aria-label="Team workspace"]');
    expect(tablist).toBeTruthy();
    expect(tablist.getAttribute('role')).toBe('tablist');
    expect(fixture.nativeElement.textContent).not.toContain('Team attendance');
    expect(fixture.nativeElement.querySelector('app-correction-approvals, app-work-area-approvals')).toBeTruthy();
  });

  it('renders both Team sub-sections when the user has both permissions', async () => {
    const { fixture } = await setup({}, true, [], [], [], {}, ['attendance:read', 'attendance:approve']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Team attendance');
    expect(fixture.nativeElement.textContent).toContain('Approvals');
  });

  it('shows a count badge only when the corrections queue is non-empty', async () => {
    const store2 = (await setup({}, false, [], [], [], {}, ['attendance:approve'])).store;
    store2.approvalInbox.set([{ id: 'c1', status: 'pending' } as any]);
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    fixture.componentInstance.selectTeamSection('approvals');
    fixture.detectChanges();
    // zero pending -> no badge
    expect(fixture.nativeElement.textContent).not.toMatch(/Attendance corrections \(0\)/);
  });

  it('embeds only the active approval type, not both, on initial entry', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-correction-approvals').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('app-work-area-approvals').length).toBe(0);
  });
```

Adjust the mocked `store.approvalInbox`/`workAreaApprovalInboxTotalCount` added in Task 6 to be plain writable signals (already the case) so `store2.approvalInbox.set(...)` works — note the second `it` above sets up an unused `store2`/discard pattern; simplify to directly assert against the `store` returned by the single `setup()` call in that test rather than creating two fixtures. Adjust as needed to keep it a single coherent assertion; the important behavior under test is "0 pending renders no badge."

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts"`
Expected: fail — `app-correction-approvals`/`app-work-area-approvals` are not yet imported/rendered in this component, and `[aria-label="Team workspace"]` doesn't exist.

- [ ] **Step 3: Implement**

In `time-tracking.component.ts`, add the two panel imports:

```typescript
import { CorrectionApprovalsComponent } from '../correction-approvals/correction-approvals.component';
import { WorkAreaApprovalsComponent } from '../work-area-approvals/work-area-approvals.component';
```

and add both to the `@Component` `imports` array:

```typescript
  imports: [BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, WorkAreaApprovalsComponent],
```

In `time-tracking.component.html`:

Simplify the two guards around the My-view Today block (line 30) and the My-view history/requests block (line 155) to drop their now-redundant `|| !canShowTeamView()` / `|| !hasCoveredAccess()` clauses (both are now fully subsumed by `viewMode()`'s own fallback logic — see Task 6 Step 3 rationale):

```html
  @if (viewMode() === 'my') {
```

(replace both occurrences — line 30's `@if (viewMode() === 'my' || !canShowTeamView()) {` and line 155's `@if (viewMode() === 'my' || !hasCoveredAccess()) {` — with this exact line).

Replace the whole Team block (current lines 380-436, `@if (viewMode() === 'team' && canShowTeamView()) { ... }`) with:

```html
  @if (viewMode() === 'team') {
    <div class="attendance-view-toggle" role="tablist" aria-label="Team workspace">
      @if (hasCoveredAccess()) {
        <button type="button" role="tab" id="team-tab-attendance" class="attendance-view-toggle__option" [class.attendance-view-toggle__option--active]="teamSection() === 'attendance'" [attr.aria-selected]="teamSection() === 'attendance'" aria-controls="team-panel-attendance" tabindex="0" (click)="selectTeamSection('attendance')">Team attendance</button>
      }
      @if (hasApproveAccess()) {
        <button type="button" role="tab" id="team-tab-approvals" class="attendance-view-toggle__option" [class.attendance-view-toggle__option--active]="teamSection() === 'approvals'" [attr.aria-selected]="teamSection() === 'approvals'" aria-controls="team-panel-approvals" tabindex="0" (click)="selectTeamSection('approvals')">Approvals</button>
      }
    </div>

    @if (teamSection() === 'attendance' && hasCoveredAccess()) {
      <section id="team-panel-attendance" role="tabpanel" aria-labelledby="team-tab-attendance" class="history-card" aria-label="Team attendance">
        <div class="section-heading section-heading--stacked-mobile">
          <div><p class="eyebrow">Attendance oversight</p><h2 id="covered-history-heading">Team attendance</h2></div>
          <div>
            @if (canViewCoveredEmployees()) { <span class="access-note">Visible coverage records</span> }
            <div class="range-controls" aria-label="Team attendance date range">
              <app-date-range-picker
                [from]="historyFrom()"
                [to]="historyTo()"
                [disabled]="store.coveredHistoryLoading()"
                (rangeChange)="onRangeSelected($event)"
              />
            </div>
          </div>
        </div>
        @if (store.coveredHistoryLoading()) {
          <div class="table-skeleton" aria-busy="true" aria-label="Loading team attendance"></div>
        } @else if (store.coveredHistoryError()) {
          <div class="time-tracking-message time-tracking-message--error" role="alert"><p>{{ store.coveredHistoryError() }}</p>@if (store.coveredHistoryError() !== 'You do not have access to view team attendance.') { <app-button type="button" variant="secondary" size="sm" (pressed)="retryCoveredHistory()">Try again</app-button> }</div>
        } @else if (store.today() && !canViewCoveredEmployees()) {
          <p class="empty-copy">Team attendance is not available for your coverage area.</p>
        } @else if (store.coveredHistory().length === 0) {
          <p class="empty-copy">No team attendance records for this date range.</p>
        } @else {
          <div class="table-scroll">
            <table class="attendance-table">
              <thead><tr><th scope="col">Employee</th><th scope="col">Date</th><th scope="col">Clock in</th><th scope="col">Clock out</th><th scope="col">Break</th><th scope="col">Worked time</th><th scope="col">Status</th></tr></thead>
              <tbody>
                @for (row of store.coveredHistory(); track row.attendanceRecordId) {
                  <tr>
                    <td><span class="table-primary">{{ employeeLabel(row) }}</span>@if (row.employee?.employeeNumber) { <span class="table-secondary">{{ row.employee?.employeeNumber }}</span> }</td>
                    <td>{{ formatDate(row.workDate) }}</td>
                    <td>{{ formatDateTime(row.clockInAt, displayTimezone()) }}</td>
                    <td>{{ formatDateTime(row.clockOutAt, displayTimezone()) }}</td>
                    <td><span class="table-primary">{{ formatMinutes(row.breakMinutes) }}</span>@if (hasBreakOverage(row.breakOverageMinutes, row.isOverBreakAllowance)) { <span class="table-note table-note--warning">{{ breakOverageHistoryLabel(row.breakOverageMinutes) }}</span> }</td>
                    <td>{{ formatMinutes(row.totalWorkedMinutes) }}</td>
                    <td><span class="table-primary">{{ statusLabel(row.status, row.statusLabel) }}</span>@if (hasAttention(row.attentionLabel)) { <span class="table-note">{{ row.attentionLabel }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (store.coveredHistoryTotalCount() > store.coveredHistoryPageSize()) {
            <div class="tt-pagination">
              <span class="tt-pagination-info">
                Page {{ store.coveredHistoryPage() }} of {{ Math.ceil(store.coveredHistoryTotalCount() / store.coveredHistoryPageSize()) }}
              </span>
              <div class="tt-pagination-buttons">
                <app-button type="button" variant="secondary" [disabled]="store.coveredHistoryPage() <= 1" (pressed)="goToCoveredHistoryPage(store.coveredHistoryPage() - 1)">Previous</app-button>
                <app-button type="button" variant="secondary" [disabled]="store.coveredHistoryPage() * store.coveredHistoryPageSize() >= store.coveredHistoryTotalCount()" (pressed)="goToCoveredHistoryPage(store.coveredHistoryPage() + 1)">Next</app-button>
              </div>
            </div>
          }
        }
      </section>
    }

    @if (teamSection() === 'approvals' && hasApproveAccess()) {
      <section id="team-panel-approvals" role="tabpanel" aria-labelledby="team-tab-approvals" class="history-card" aria-labelledby="approvals-heading">
        <div class="section-heading">
          <div><p class="eyebrow">Review queue</p><h2 id="approvals-heading">Approvals</h2><p class="access-note">Review attendance requests assigned to you.</p></div>
        </div>
        <div class="my-requests-tablist" role="tablist" aria-label="Approval type">
          <button type="button" role="tab" id="approval-type-tab-corrections" class="my-requests-tab" [class.my-requests-tab--active]="approvalType() === 'corrections'" [attr.aria-selected]="approvalType() === 'corrections'" aria-controls="approval-type-panel-corrections" tabindex="0" (click)="selectApprovalType('corrections')">
            Attendance corrections@if (approvalBadgeCorrections() > 0) { ({{ approvalBadgeCorrections() }}) }
          </button>
          <button type="button" role="tab" id="approval-type-tab-work-area" class="my-requests-tab" [class.my-requests-tab--active]="approvalType() === 'work-area'" [attr.aria-selected]="approvalType() === 'work-area'" aria-controls="approval-type-panel-work-area" tabindex="0" (click)="selectApprovalType('work-area')">
            Work-area changes@if (approvalBadgeWorkArea() > 0) { ({{ approvalBadgeWorkArea() }}) }
          </button>
        </div>
        @if (approvalType() === 'corrections') {
          <div id="approval-type-panel-corrections" role="tabpanel" aria-labelledby="approval-type-tab-corrections" tabindex="0">
            <app-correction-approvals [embedded]="true" />
          </div>
        } @else {
          <div id="approval-type-panel-work-area" role="tabpanel" aria-labelledby="approval-type-tab-work-area" tabindex="0">
            <app-work-area-approvals [embedded]="true" />
          </div>
        }
      </section>
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts"`
Expected: all pass, including every pre-existing test in the file (the My-view path and its markup are untouched aside from the two simplified guard conditions).

- [ ] **Step 5: Run the full attendance suite**

Run: `npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"`
Expected: pass.

---

### Task 8: Notification bell — repoint attendance approval deep links

**Files:**
- Modify: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts`
- Modify: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace the two existing assertions in `notification-bell.component.spec.ts` (lines 162 and 186):

```typescript
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', section: 'approvals', type: 'corrections', requestId: 'c1' } }
    );
```

```typescript
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', section: 'approvals', type: 'work-area', requestId: 'wa-1' } }
    );
```

(Leave the two test bodies and their `item`/store setup otherwise unchanged — only the `navigate` expectation target and `queryParams` change. The non-navigable and unrelated-notification tests at the bottom of the file are untouched.)

- [ ] **Step 2: Run to verify failure**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts"`
Expected: 2 failures — production code still navigates to `/attendance/corrections/approvals` and `/attendance/work-area-change-requests/approvals`.

- [ ] **Step 3: Implement**

In `notification-bell.component.ts`, replace the two `if` blocks inside `navigateFromNotification` (lines 125-137):

```typescript
    if (item.isNavigable && item.destinationKey === 'attendance_correction_approval' && item.attendanceCorrectionId) {
      await this.router.navigate(['/attendance/time-tracking'], {
        queryParams: { view: 'team', section: 'approvals', type: 'corrections', requestId: item.attendanceCorrectionId }
      });
      return;
    }

    if (item.isNavigable && item.destinationKey === 'work_area_change_approval' && item.workAreaChangeRequestId) {
      await this.router.navigate(['/attendance/time-tracking'], {
        queryParams: { view: 'team', section: 'approvals', type: 'work-area', requestId: item.workAreaChangeRequestId }
      });
      return;
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx ng test --no-watch --include "src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts"`
Expected: all pass.

---

### Task 9: Full verification and final report

**Files:**
- Create: `TIME_TRACKING_FRONTEND_TEAM_APPROVALS_CONSOLIDATION_REPORT.md` (repo root)

- [ ] **Step 1: Run the targeted suites**

```bash
npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"
npx ng test --no-watch --include "src/app/layouts/main-layout/**/*.spec.ts"
npx ng test --no-watch --include "src/app/core/**/*.spec.ts"
```

Record pass/fail counts for each.

- [ ] **Step 2: Run the full suite and the build**

```bash
npx ng test --no-watch
npm run build
git --no-pager diff --check
```

Record the exact test-file/test counts, build result (including any pre-existing unrelated warnings — do not silence or "fix" warnings in files this plan didn't touch), and the diff --check result.

- [ ] **Step 3: If any unrelated pre-existing failure appears**

Reproduce it against `git stash` (this task's changes only, keeping the pre-existing untouched working-tree changes) if practical, or otherwise document: exact file, exact test name, expected vs. actual, and why it's unrelated to this task. Do not edit unrelated production code to force it green.

- [ ] **Step 4: Manual verification (if a runnable local environment is available)**

Follow the 12-point manual verification list from the task brief (self-service-only user sees My with no Team toggle; `attendance:read`-only user sees Team attendance but no Approvals; `attendance:approve`-only user opens directly into Team → Approvals without unauthorized calls — verify via the browser Network tab that no `/today`, `/history`, or `/corrections/my` request fires for that user; both permissions together allow switching; corrections/work-area tabs load independently; approve/reject still work; empty queues show friendly empty states; old URLs redirect; notification clicks land correctly; sidebar shows only Time Tracking under Attendance; Back/Forward restores state; mobile/tablet has no horizontal overflow). If no runnable environment is available, state that explicitly in the report rather than claiming it passed.

- [ ] **Step 5: Write `TIME_TRACKING_FRONTEND_TEAM_APPROVALS_CONSOLIDATION_REPORT.md`**

Include, using the prior two consolidation/hardening reports in this repo as the format precedent:
- Initial `git status --short --branch` output (captured at the start of this plan, before Task 1).
- The two confirmed pre-existing navigation/permission flaws (outer `app.routes.ts` gate missing `attendance:approve`; Team view previously required `attendance:read` AND `Today.canViewCoveredEmployees`).
- Full list of files changed (from Tasks 1-8).
- Final route contract (time-tracking permissions array; legacy redirect routes and their data).
- Final permission matrix (the table from the task brief, confirmed against the actual test results).
- Query-parameter contract (the five canonical URL forms from the task brief).
- Legacy redirect behavior (mapping, `replaceUrl`, requestId preservation).
- Notification mapping changes.
- Approval component reuse approach (embedded-mode input, why `requestId` stayed `ActivatedRoute`-based instead of becoming an `@Input`).
- Which API calls were deliberately left separate (corrections vs. work-area: distinct endpoints, DTOs, store slices, pagination — unchanged from the pre-existing design).
- Tests added/updated per task, with final counts from Step 1-2.
- Exact commands run and their actual results (not fabricated — paste real output/counts from Steps 1-2).
- Skipped checks (E2E/Playwright, live backend, screen-reader audit — unless actually run).
- Remaining risks (e.g., the known limitation from Task 3/4 that clicking a second same-type notification while that panel is already mounted won't re-trigger the deep link, matching the pre-existing standalone-route behavior).
- Confirmation no backend files were changed.
- Confirmation nothing was staged, committed, or pushed (`git status --short --branch` re-run at the end should show the same set of files, now with more edits, still all unstaged).

---

## Self-review notes (for whoever executes this plan)

- Task 6's `viewMode` fallback logic intentionally makes the redundant clauses in the template's My-view guards (Task 7 Step 3) dead code before they're removed — removing them is a correctness fix, not just cleanup, because the old `!hasCoveredAccess()` clause would have wrongly shown My content to a `team`-view approve-only-without-read user. Do not skip that part of Task 7.
- Every new template block above reuses `.attendance-view-toggle` / `.attendance-view-toggle__option` or `.my-requests-tablist` / `.my-requests-tab` — confirm after Task 7 that `time-tracking.component.css` file size is unchanged (still ~7.8 kB) via `npm run build`'s stylesheet-budget warnings (none expected for this file).
- If `side-navbar.component.spec.ts` or `sub-sidebar.component.spec.ts` (found via Task 1 Step 5) hard-code the old 3-child Attendance list, they must be updated in Task 1, not deferred.
