# ONEVO HRMS — Time Tracking Team Approvals Consolidation Report

**Date:** 26 August 2026
**Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`
**Branch:** `feature/employee-management-phase1-foundation`

## Initial git status

```
## feature/employee-management-phase1-foundation
 M src/app/app.routes.spec.ts
 M src/app/core/services/notification-api.service.ts
 M src/app/layouts/main-layout/nav/nav-items.config.ts
 M src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts
 M src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts
 M src/app/modules/attendance/attendance.routes.spec.ts
 M src/app/modules/attendance/attendance.routes.ts
 M src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts
 M src/app/modules/attendance/data-access/time-tracking-api.service.ts
 M src/app/modules/attendance/feature/time-tracking/time-tracking.component.css
 M src/app/modules/attendance/feature/time-tracking/time-tracking.component.html
 M src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts
 M src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts
 M src/app/modules/attendance/state/time-tracking.store.spec.ts
 M src/app/modules/attendance/state/time-tracking.store.ts
 M src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts
 M src/styles.css
?? TIME_TRACKING_FRONTEND_MY_REQUESTS_CONSOLIDATION_REPORT.md
?? WORK_AREA_CHANGE_REQUEST_FRONTEND_HARDENING_REPORT.md
?? src/app/modules/attendance/feature/work-area-approvals/
?? src/app/modules/attendance/models/work-area-change-request.model.spec.ts
?? src/app/modules/attendance/models/work-area-change-request.model.ts
```

This working tree already carried the "My requests" tab consolidation and Work Area hardening work from prior sessions (see the two reports named above). None of it was reverted, reformatted, or touched beyond what this task required.

## Confirmed pre-existing flaws (before this task)

1. **Outer route gate missing `attendance:approve`.** `src/app/app.routes.ts`'s `attendance` child route (which wraps the lazy-loaded `ATTENDANCE_ROUTES`) only allowed `attendance:read-own`, `attendance:write-own`, `attendance:read`. An `attendance:approve`-only user was rejected at this gate and never reached `attendance.routes.ts`'s `time-tracking` route at all — fixing the inner route alone would not have been sufficient.
2. **`time-tracking` route itself missing `attendance:approve`.** Same gap, one level in.
3. **Team view required `attendance:read` AND `Today.canViewCoveredEmployees`**, and the two standalone approval pages required only `attendance:approve` but lived outside Time Tracking entirely, with their own sidebar entries. An approval-only user (no `attendance:read`, no self-service permissions) had no way to reach a working Team workspace inside Time Tracking, and the Attendance nav parent could show a `Time Tracking` child whose route gate excluded them.
4. **Nav config**: the `time-attendance-tracking` child's `requiredPermissions` excluded `attendance:approve`, so an approval-only user saw the Attendance parent (which does include `attendance:approve`) with zero reachable children — `canAccessNavItem`'s parent-needs-a-reachable-child rule would hide the whole section.

## Files changed

### Production code
- `src/app/app.routes.ts` — added `attendance:approve` to the outer `attendance` route's permission array.
- `src/app/modules/attendance/attendance.routes.ts` — added `attendance:approve` to `time-tracking`'s permission array; replaced the `corrections/approvals` and `work-area-change-requests/approvals` routes' `loadComponent` targets with the new `LegacyApprovalRedirectComponent`, adding an `approvalType` data key to each.
- `src/app/layouts/main-layout/nav/nav-items.config.ts` — removed the `time-attendance-correction-approvals` and `time-attendance-work-area-approvals` children; added `attendance:approve` to the surviving `time-attendance-tracking` child.
- `src/app/modules/attendance/state/time-tracking.store.ts` — added `approvalInboxLoaded` and `workAreaApprovalInboxLoaded` boolean state, set `true` only on a successful load of the respective inbox.
- `src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.ts` / `.html` — added an `embedded` signal input; `ngOnInit` now checks `store.approvalInboxLoaded()` and skips the fetch (reusing already-loaded data) when true, calling a new private `tryOpenDeepLink()` instead; the breadcrumb header and section heading are hidden when `embedded()` is true.
- `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.ts` / `.html` — same `embedded` input and cache-aware `ngOnInit`/`tryOpenDeepLink()` pattern.
- `src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.ts` (new) — reads `route.snapshot.data['approvalType']` and `queryParamMap.get('requestId')`, calls `router.navigate(['/attendance/time-tracking'], { queryParams: { view: 'team', section: 'approvals', type, requestId }, replaceUrl: true })`.
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` — added `hasSelfServiceAccess`, `hasApproveAccess` permission computeds; `hasCoveredAccess` unchanged in meaning; `canShowTeamView` widened to `hasCoveredAccess() || hasApproveAccess()`; `viewMode`, `teamSection`, `approvalType`, `deepLinkRequestId` derived as `computed()` from `toSignal(route.queryParamMap)` plus the permission computeds; `selectViewMode`/new `selectTeamSection`/`selectApprovalType` now navigate via `Router` instead of setting a local signal; `ngOnInit` gates `loadToday` on `hasSelfServiceAccess() || hasCoveredAccess()` and gates `loadMyHistory`/`ensureRequestTabLoaded` on `hasSelfServiceAccess()` alone; a new constructor `effect()` drives Team-section data loading with a per-activation dedupe guard (see Incident section below).
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html` — simplified the two My-view guards to `viewMode() === 'my'`; replaced the Team block with a `role="tablist"` Team-attendance/Approvals sub-nav (reusing `.attendance-view-toggle` classes) and, inside Approvals, a second `role="tablist"` for approval type (reusing `.my-requests-tablist`/`.my-requests-tab` classes) embedding `<app-correction-approvals [embedded]="true" />` / `<app-work-area-approvals [embedded]="true" />`. No new CSS rules were added.
- `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts` — both attendance notification destinations now navigate to `/attendance/time-tracking` with `{ view: 'team', section: 'approvals', type: 'corrections' | 'work-area', requestId }` instead of the old standalone-page routes.

### Tests
- `src/app/app.routes.spec.ts`, `src/app/modules/attendance/attendance.routes.spec.ts` — updated permission-array assertions; the attendance-routes spec's two approval tests now assert the redirect component wiring and `approvalType` data instead of the old feature components.
- `src/app/layouts/main-layout/nav/nav-access.spec.ts` — the real-config Attendance test now covers `attendance:approve`-only access and asserts the nav children list is exactly `['time-attendance-tracking']`.
- `src/app/modules/attendance/state/time-tracking.store.spec.ts` — added `getApprovalInbox` to the API mock; added 4 tests for the two new `*Loaded` flags.
- `src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.spec.ts`, `.../work-area-approvals/work-area-approvals.component.spec.ts` — added `approvalInboxLoaded`/`workAreaApprovalInboxLoaded` to their store mocks; added embedded-mode and cache-reuse tests.
- `src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.spec.ts` (new) — 3 tests covering both redirect targets and the no-requestId case.
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts` — extended the store mock with every field the two embedded panels' templates touch (since they're now real, unmocked child components sharing the same injected store); extended the `PermissionService` mock to support arbitrary per-test permission sets via a new optional `permissions` parameter on `setup()`; added 13 new tests for the permission matrix, URL-state resolution, Team sub-nav rendering, and approval-type embedding; fixed 3 pre-existing tests that clicked the Team toggle and asserted synchronously — they now `await fixture.whenStable()` first, since `selectViewMode` navigates through the Router asynchronously instead of setting a local signal.
- `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts` — updated the two attendance-notification navigation assertions to the new canonical URL/queryParams.

## Final route contract

```typescript
// attendance.routes.ts
{
  path: 'time-tracking',
  canActivate: [permissionGuard],
  data: {
    permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
    modules: ['time_attendance']
  },
  loadComponent: () => import('./feature/time-tracking/time-tracking.component')...
}
```

`app.routes.ts`'s outer `attendance` child route carries the identical 4-permission array. Both legacy routes (`corrections/approvals`, `work-area-change-requests/approvals`) keep `canActivate: [permissionGuard]`, `permissions: ['attendance:approve']`, `modules: ['time_attendance']` unchanged, and now `loadComponent` resolves `LegacyApprovalRedirectComponent` with `data.approvalType` set to `'corrections'` / `'work-area'` respectively.

## Final permission matrix (as implemented and tested, corrected twice — see below)

| Permissions | My view | Team → Attendance | Team → Approvals |
|---|---:|---:|---:|
| Self-service only (`attendance:read-own`/`write-own`) | Visible | Hidden | Hidden |
| `attendance:read` only, no coverage (`Today.canViewCoveredEmployees = false`) | Hidden (no self-service perm) | **Hidden** | Hidden |
| `attendance:read` only, with coverage | Hidden (no self-service perm) | Visible | Hidden |
| `attendance:approve` only, **no coverage** | Hidden | **Hidden** | **Hidden — Team is unreachable** |
| `attendance:approve` + coverage | depends on self-service perms | Visible | Visible |
| `attendance:read` + `attendance:approve`, with coverage | depends on self-service perms | Visible | Visible |

Team view (and everything inside it) is gated on `Today.canViewCoveredEmployees` alone. `attendance:approve` no longer has any independent power to open Team view — see the third correction below for why.

`Today` continues to be fetched whenever `hasSelfServiceAccess() || hasCoveredAccess()`, matching the pre-existing call pattern and excluding pure approval-only users as required.

### Correction: Team-attendance visibility must key off actual coverage, not the `attendance:read` permission

The first version of this task gated the Team-attendance tab (and the top-level My/Team toggle, together with `hasApproveAccess()`) on `hasCoveredAccess()` — i.e. on holding the `attendance:read` permission. The user caught this during live testing: `attendance:read` is a **universal** permission granted to every employee, exactly like the self-service permissions — it says nothing about whether that employee actually has anyone reporting to them. Gating tab visibility on it would have shown "Team attendance" to literally every user in the tenant.

The correct signal — already computed in this component before this task even started, as `canViewCoveredEmployees = computed(() => this.store.today()?.canViewCoveredEmployees ?? false)` — is the backend-derived "does this person actually have covered employees" flag on `Today`. Every place that previously read `hasCoveredAccess()` to decide Team-attendance visibility or data-loading was switched to `canViewCoveredEmployees()` instead: `canShowTeamView`, `teamSection()`'s default/validation, `selectViewMode()`'s default section, the constructor effect's load-guard, `loadForCurrentView()`, `retryCoveredHistory()`, and the two template gates (the "Team attendance" tab button and its panel). `hasCoveredAccess()` (the raw permission) is left defined but is no longer used to control any visibility or loading decision — `needsToday` deliberately still uses it (alongside `hasSelfServiceAccess()`) as a coarse "might this user need Today at all" pre-check, since `canViewCoveredEmployees()` cannot be evaluated before `Today` has loaded in the first place.

One second-order fix followed from this: the template's old `@else if (store.today() && !canViewCoveredEmployees())` "Team attendance is not available for your coverage area." branch inside the attendance panel became unreachable dead code, since the panel itself now only renders when `canViewCoveredEmployees()` is already true — it was removed, along with the now-always-true `@if (canViewCoveredEmployees())` wrapper around the "Visible coverage records" note (now rendered unconditionally in that panel).

One test needed updating (`'shows Team attendance...for a read-only user'` now also sets `canViewCoveredEmployees: true` in its `Today` fixture), and one new regression test was added — `'does not show Team attendance for a user who has attendance:read (a universal permission) but no one covered'` — asserting `canShowTeamView()` is `false` and the text "Team attendance" never renders for that combination. Re-ran `time-tracking.component.spec.ts` (55/55 pass, was 54), the full attendance suite (157/157, was 156), the full suite (196 files / 1,543 tests, was 1,542), and `npm run build` (exit 0, unchanged CSS budget warning) — all green after the correction.

### Second correction: don't render a single-option Team sub-nav

The Team-attendance/Approvals sub-nav (`role="tablist"`) was unconditionally rendered inside `viewMode() === 'team'`, with each button independently `@if`-gated on its own permission. For a user with only one of the two capabilities (the common approve-only or coverage-only case, now that visibility is correctly permission/coverage-scoped per the correction above), this produced a single lone pill sitting in a `role="tablist"` with nothing to switch to or from — a broken affordance implying a choice that doesn't exist, caught by the user from a live screenshot.

Fixed by adding `hasBothTeamSections = computed(() => this.canViewCoveredEmployees() && this.hasApproveAccess())` and wrapping the entire tab-strip `<div role="tablist">` in `@if (hasBothTeamSections())`. `teamSection()`'s existing default-resolution logic already picks the one available section correctly with no toggle present, so the section itself (Team attendance or Approvals) still renders directly — just without a pointless one-button switcher above it. The two panel `<section>` elements' `role="tabpanel"`/`aria-labelledby` attributes were also made conditional (`[attr.role]`/`[attr.aria-labelledby]` bound to `hasBothTeamSections() ? … : null`), since a `tabpanel` referencing a `tab` that isn't in the DOM is itself an accessibility bug. The My/Team top-level toggle and its underlying logic were left untouched, as requested.

Updated the test that had asserted a tablist always renders for an approve-only user to instead assert it's absent while the Approvals content still shows directly; added a symmetric test for the coverage-only case, and a test confirming the tablist *does* render when both are present. Re-ran `time-tracking.component.spec.ts` (56/56), the full attendance suite (158/158), the full suite (196 files / 1,544 tests), and `npm run build` (exit 0, unchanged CSS budget warning) — all green.

### Third correction: no toggle at all — Team attendance and Approvals always show together; Team itself requires real coverage

The user, testing live, rejected the sub-nav entirely (not just the single-option case fixed above) and rejected `attendance:approve` as an independent way into Team view: in this product's data model an approver is always someone's covered manager, so "approve without coverage" is not a real case to design for, and forcing people to toggle between "Team attendance" and "Approvals" when they're entitled to see both is pointless friction — both should just render, stacked, whenever the relevant permission/coverage applies.

Two changes: (1) `canShowTeamView` was narrowed from `canViewCoveredEmployees() || hasApproveAccess()` to `canViewCoveredEmployees()` alone — Team view is now unreachable without real coverage, full stop, regardless of `attendance:approve`. (2) The `teamSection`/`hasBothTeamSections`/sub-nav-toggle machinery from the two corrections above was removed entirely (`teamSection` computed, `selectTeamSection()`, the tab-strip `<div role="tablist" aria-label="Team workspace">` and its two buttons, and the `role="tabpanel"`/`aria-labelledby` bindings on both panels). Once inside Team view, the Team-attendance `<section>` renders whenever `canViewCoveredEmployees()` is true and the Approvals `<section>` renders whenever `hasApproveAccess()` is true — independently, simultaneously, with no selection state between them. The constructor loading `effect()` was correspondingly rewritten to load both (each still independently dedupe-guarded, per the earlier loop-fix) instead of switching on a selected section. The `section` query parameter is gone from the entire contract — it no longer has anything to select — and was dropped from `selectViewMode()`'s navigation, `LegacyApprovalRedirectComponent`, and both notification-bell destinations (updated below). The inner Attendance-corrections/Work-area-changes tablist inside Approvals is a genuinely different kind of choice (which approval queue to review) and was left exactly as it was.

One consequence worth flagging explicitly: a hypothetical user holding `attendance:approve` but with `Today.canViewCoveredEmployees = false` can no longer reach Approvals at all through this UI — Team view is closed to them entirely. This is intentional per the user's explicit direction that this permission combination does not occur in their system; if it turns out to occur in practice for some account, that account will see no Team entry point and no way to review anything assigned to them, which would need to be re-opened as a product decision, not silently patched around here.

Rewrote the block of tests spanning approve-only/coverage-only/self-service-only/both-together scenarios to match: an approve-only-without-coverage user now asserts `canShowTeamView()` is `false`, `viewMode()` stays `'my'`, no Approvals content renders, and neither `loadApprovalInbox` nor `loadWorkAreaApprovalInbox` is called; the coverage-only test is unchanged (still valid under the new model); a new test asserts Team attendance and Approvals both render with no `[aria-label="Team workspace"]` element anywhere in the DOM when both apply. Three tests that previously needed only `attendance:approve` to reach Approvals (`shows a count badge…`, `embeds only the active approval type…`, `embeds the work-area panel…`) now also grant `canViewCoveredEmployees: true` in their `Today` fixture, since that is now a precondition for reaching Team at all. Re-ran `time-tracking.component.spec.ts` (53/53, down from 56 — several tests describing the now-removed toggle and the now-invalid approve-implies-Team assumption were consolidated rather than patched), the full attendance suite (155/155), the full main-layout suite (68/68, covering the updated notification-bell assertions), the full suite (196 files / 1,541 tests), `npm run build` (exit 0, unchanged CSS budget warning), and `git --no-pager diff --check` (exit 0) — all green.

## Query-parameter contract

- `/attendance/time-tracking` — My view (default when self-service access exists).
- `/attendance/time-tracking?view=team` — Team view: Team attendance and/or Approvals render together, whichever the viewer has coverage/`attendance:approve` for. There is no `section` parameter — nothing left to select between.
- `/attendance/time-tracking?view=team&type=corrections` — Team view with the Approvals panel's active queue set to Attendance corrections (the default when `type` is omitted or invalid).
- `/attendance/time-tracking?view=team&type=work-area` — Team view with the Approvals panel's active queue set to Work-area changes.
- `...&requestId={id}` appended to either `type` variant opens/targets that pending request inside the Approvals panel.

`view` and `type` are derived as `computed()` signals over `toSignal(route.queryParamMap)` combined with the permission/coverage computeds; an invalid or unauthorized `view=team` falls back to `my` without navigating and without issuing any unauthorized load (the loading `effect()` re-checks permissions independently of the URL). Clicking My/Team or an approval-type tab calls `router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge' })` with no `replaceUrl`, so Back/Forward restores prior states.

## Legacy redirect behavior

`LegacyApprovalRedirectComponent` renders nothing; on `ngOnInit` it reads `route.snapshot.data['approvalType']` and `queryParamMap.get('requestId')` and calls `router.navigate(['/attendance/time-tracking'], { queryParams: { view: 'team', type, requestId }, replaceUrl: true })`. `replaceUrl: true` means the obsolete URL never remains as a back-button stop. `permissionGuard` still runs first with the same `attendance:approve` + `time_attendance` gate as before, so an unauthorized visit to a legacy URL is rejected exactly as before (routed to `/dashboard`) rather than reaching the redirect. Per the third correction above, a visitor who passes that guard but has no real coverage will land on `/attendance/time-tracking?view=team&type=...` and see the My view instead of Approvals, since Team view requires coverage now — this is the same "approve without coverage doesn't happen" boundary noted above, not a redirect bug.

## Notification mapping changes

Both `attendance_correction_approval` and `work_area_change_approval` destination keys now navigate to `/attendance/time-tracking` with `view=team&type=...&requestId=...` query params (no `section`, per the third correction) instead of the old standalone-page URLs. Non-navigable requester notifications, and every unrelated notification type (`task_creation_request`, `objective_change_request`, etc.), are untouched.

## Approval component reuse approach

`CorrectionApprovalsComponent` and `WorkAreaApprovalsComponent` remain the single implementation of each approval workflow (list loading, review modal, approve/reject, validation, pagination for Work Area, stale/409 handling). They gained one `embedded = input(false)` signal input that hides only their own breadcrumb header and section heading — every other template block, and all component logic, is unchanged. Because they are now rendered directly inside `TimeTrackingComponent`'s template (not via a route), `ActivatedRoute` resolves to the *same* `/attendance/time-tracking` route both components already had `inject()`ed, so their existing `route.snapshot.queryParamMap.get('requestId')` deep-link logic keeps working with zero rewiring — `requestId` was deliberately **not** converted to an `@Input`, to avoid rewriting the recently-hardened Work Area deep-link test suite for no behavioral gain. The one addition per component is a cache check: `ngOnInit` now calls a new private `tryOpenDeepLink()` (extracted from the old `load()` body) directly when `store.approvalInboxLoaded()` / `workAreaApprovalInboxLoaded()` is already `true`, and only calls the (unconditional, always-refetching) `load()` otherwise — matching the "Try again" retry button's existing behavior of always bypassing the cache.

## API calls deliberately left separate

`getApprovalInbox` (unpaged, returns the full pending array — confirmed by reading `time-tracking-api.service.ts`, so `store.approvalInbox().length` is a true total, not a page count) and `getWorkAreaChangeApprovalInbox` (paged) remain two distinct endpoints with two distinct store slices, two distinct loading/error signals, and two distinct approve/reject/pagination method sets. Nothing in this task merged them into a shared DTO or a shared status model — the Approvals workspace unification is purely at the page/navigation layer, exactly as the pre-existing "My requests" tab consolidation established for the self-service side.

## Tests added/updated per task

| Task | New tests | Notes |
|---|---:|---|
| 1 — permission gates | 0 new, 3 spec bodies rewritten | app.routes, attendance.routes, nav-access |
| 2 — store loaded flags | 4 | |
| 3 — CorrectionApprovals embedded | 4 | |
| 4 — WorkAreaApprovals embedded | 4 | |
| 5 — legacy redirect | 3 (new file) | |
| 6 — TimeTrackingComponent permission/state | 7 | + 3 pre-existing tests fixed for async navigation |
| 7 — TimeTrackingComponent template | 5 | |
| 8 — notification bell | 0 new, 2 spec bodies rewritten | |
| **Total new test files** | 1 (`legacy-approval-redirect.component.spec.ts`) | |

## Exact commands run and results

| Command | Result |
|---|---|
| `npx ng test --no-watch --include "src/app/app.routes.spec.ts" --include "src/app/modules/attendance/attendance.routes.spec.ts" --include "src/app/layouts/main-layout/nav/nav-access.spec.ts"` | **Passed:** 3 test files, 21 tests |
| `npx ng test --no-watch --include "src/app/layouts/main-layout/**/*.spec.ts"` | **Passed:** 9 test files, 68 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/state/time-tracking.store.spec.ts"` | **Passed:** 1 test file, 24 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/feature/correction-approvals/correction-approvals.component.spec.ts"` | **Passed:** 1 test file, 10 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts"` | **Passed:** 1 test file, 22 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/feature/legacy-approval-redirect/legacy-approval-redirect.component.spec.ts"` | **Passed:** 1 test file, 3 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/attendance.routes.spec.ts"` | **Passed:** 1 test file, 4 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts"` | **Passed:** 1 test file, 54 tests |
| `npx ng test --no-watch --include "src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts"` | **Passed:** 1 test file, 6 tests |
| `npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"` | **Passed:** 8 test files, 156 tests |
| `npx ng test --no-watch --include "src/app/core/**/*.spec.ts"` | **Passed:** 23 test files, 154 tests |
| `npx ng test --no-watch` (complete suite, run twice — before and after the loop-guard fix below) | **Passed both times:** 196 test files, 1,542 tests (was 195 files / 1,515 tests before this task) |
| `npm run build` (run twice) | **Passed both times**, exit code 0. Pre-existing stylesheet-budget warnings unrelated to this task's files unchanged; `time-tracking.component.css` reports as ~7.7 kB against the project's 4 kB *warning* threshold (a pre-existing warning, not an error — the `anyComponentStyle` *error* budget is materially higher and was not approached); it did not grow, since no new CSS rules were added anywhere in this task. |
| `git --no-pager diff --check` | **Passed:** exit code 0; only benign LF→CRLF conversion notices, no whitespace errors |

## Incident during verification: a reactive request loop, found and fixed

While the user was independently exercising the app against a live dev backend during this session, they observed hundreds of rapid, identical `GET /attendance/time-tracking/covered-history` requests per second, tripping the backend's public rate limiter (429 responses). This was caused by the `effect()` added in Task 6 to drive Team-section data loading: it called `store.loadCoveredHistory(range)` on every re-run with no guard preventing repeated calls for the same range. The mocked unit tests could not surface this, since they never exercise real signal-scheduling timing or a real HTTP round-trip.

**Fix applied:** the `range` read was wrapped in `untracked()` so it is no longer a reactive dependency of the effect, and two component-local (non-signal) dedupe keys — `teamAttendanceRangeKey` and `attemptedApprovalType` — were added so that, regardless of what re-triggers the effect, at most one request is issued per distinct (section, range) or (section, approval type) activation; both keys reset only when their section stops being active. This is a structural guarantee against the loop, not a timing-dependent patch. All 54 `time-tracking.component.spec.ts` tests, the full 8-file/156-test attendance suite, and the full 196-file/1,542-test suite were re-run after the fix and all pass; `npm run build` was re-run and still succeeds. The user should refresh their local dev server (hot-reload should already have picked up the fix) and re-verify no repeated requests occur before relying on this further.

## Skipped checks

- The browser/E2E (Playwright) suite, a live backend integration pass beyond the user's own manual spot-check above, a staging response-header smoke test, and a manual screen-reader accessibility audit were not run — only local unit/component tests and the production build were used, consistent with the verification gates named for this task. Given the live-loop incident above, a follow-up manual pass against a live backend (not just unit tests) is recommended before considering this fully verified end-to-end.
- The 12-point manual verification checklist from the task brief was not run item-by-item in a controlled way by this session; the user's own live testing surfaced item 3 (approve-only landing) indirectly, in the form of the request-loop bug on the Team-attendance side, but did not exercise every listed scenario.

## Remaining risks

- **Deep-link re-open while the same panel is already mounted.** If a user is already on Team → Approvals → Corrections and clicks a *second* notification for a different correction request, the embedded panel is not destroyed/recreated (its `@if` condition doesn't change), so its `ngOnInit`-driven deep-link match does not re-run. This is a pre-existing limitation carried over unchanged from the original standalone-route components (which had the identical limitation via Angular's default route-reuse behavior) — not something introduced or newly regressed by this task.
- The CSS-budget margin on `time-tracking.component.css` remains tight relative to the project's *warning* threshold (not the error threshold); any future addition to that file should budget for this.
- The request-loop incident above is a reminder that this component's effect-driven loading was not validated against a real backend before this report — see "Skipped checks."

## Confirmations

- No backend files were modified; the backend repository was not touched.
- Nothing was staged, committed, or pushed. `git status --short --branch` at the end of this task shows the same branch (`feature/employee-management-phase1-foundation`) with the additional edits and new files listed above, all unstaged.
