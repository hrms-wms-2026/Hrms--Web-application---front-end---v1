# ONEVO HRMS — Time Tracking "My Requests" Consolidation Report

**Date:** 26 August 2026
**Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`
**Branch:** `feature/employee-management-phase1-foundation`

## Original UX problem

The Time Tracking screen rendered two separate personal-request cards — "My correction requests" and "My work-area requests" — in different areas of the page, each with its own empty state. This wasted space, made two closely related histories (both are the current employee's own submitted requests) look like unrelated features, and forced the employee to look in two places for their request history.

## Final layout

The page now renders, top to bottom: Today's attendance summary, Attendance actions, My attendance history, then a single full-width **My requests** card. That card contains two accessible tabs, **Attendance corrections** (default) and **Work-area changes**; only the selected tab's history is rendered. The two-column `personal-attendance-grid` wrapper that previously split attendance history and the two request cards into a 1.6fr/1fr grid was removed — every section is now a full-width sibling inside the page's existing flex column, so "My requests" is naturally the same width as "My attendance history" with no new layout CSS required.

## Why tabs instead of merging DTOs

Attendance Corrections and Work Area Change Requests are backed by different endpoints, paging contracts, status enums, and cancellation rules (confirmed by reading `time-tracking-api.service.ts`, `time-tracking.store.ts`, `attendance-correction.model.ts`, and `work-area-change-request.model.ts` before making any change). Merging them into one array would require inventing a fake shared status/shape and would lose workflow-specific fields (e.g. correction break intervals vs. work-area current/requested area). Tabs give one coherent presentation without touching either backend contract.

## Files changed

### Component
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` — added `PersonalRequestTab` type, `selectedRequestTab` signal, `selectRequestTab()`, and a private `ensureRequestTabLoaded()` dedup helper; `ngOnInit` now loads only the default tab instead of unconditionally loading both corrections and work-area requests.
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html` — replaced the two separate `history-card` sections and the `personal-attendance-grid` wrapper with one full-width `history-card` containing a `role="tablist"` and two `role="tabpanel"` blocks (existing table/pagination/empty-state markup reused verbatim inside each panel, with updated empty-state copy).
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.css` — merged the new `.my-requests-tablist` / `.my-requests-tab` selectors into the existing `.attendance-view-toggle` rule set (same pill-shaped segmented-control visual, reusing existing tokens), removed the now-dead `.personal-attendance-grid` media rule. Net size change is a few dozen bytes; final file is 7.8 kB, under the 8 kB `anyComponentStyle` error budget (already-existing rules were not touched otherwise).
- `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts` — extended `StoreMock`/`setup()` with `myCorrectionsLoaded`, `myWorkAreaRequestsLoaded`, `cancelWorkAreaChangeRequest`, and an optional `workAreaRequests`/`loadedFlags` setup parameter; added an 18-test `describe('My requests consolidation', …)` block.

### Store
- `src/app/modules/attendance/state/time-tracking.store.ts` — added `myCorrectionsLoaded` and `myWorkAreaRequestsLoaded` booleans to `TimeTrackingState` (both default `false`), set to `true` on a successful `loadMyCorrections()` / `loadMyWorkAreaRequests()` respectively. No other state, filters, paging, or mutation method was merged or renamed.
- `src/app/modules/attendance/state/time-tracking.store.spec.ts` — added 3 tests asserting the loaded flags flip to `true` only after a successful load and stay `false` after a failed one.

No file outside `src/app/modules/attendance/**` and this report was touched. No backend file was modified.

## Backend contracts remain separate

`TimeTrackingApiService` is unchanged: `getMyCorrections(page, pageSize)` and `getMyWorkAreaChangeRequests(query)` remain two distinct methods hitting `attendance/corrections/my` and `attendance/work-area-change-requests/my`. The store keeps fully independent state slices (`myCorrections*` vs `myWorkAreaRequests*`), independent filter objects, and independent mutation methods (`cancelCorrection` vs `cancelWorkAreaChangeRequest`). The component never combines the two arrays into a shared list or a shared status model — each tab's table renders its own typed array with its own status-label function (`correctionStatusLabel` vs `workAreaChangeStatusLabel`).

## API loading and deduplication behavior

- `ngOnInit` now loads only the default tab (`Attendance corrections`) via `ensureRequestTabLoaded('corrections')`.
- `selectRequestTab(tab)` sets the local UI signal and calls `ensureRequestTabLoaded(tab)`, which checks the store's `myCorrectionsLoaded` / `myWorkAreaRequestsLoaded` flag before issuing a load — so Work Area requests load once, the first time that tab is selected, and not again on subsequent visits.
- Switching tabs back and forth after both have loaded successfully issues no further requests (verified by a test that toggles tabs three times and asserts zero additional calls).
- The existing "Try again" retry buttons still call the store's loader directly (bypassing the dedup check), so a manual retry always re-issues that tab's request — confirmed to affect only the failed workflow.
- Existing mutation-triggered refreshes are untouched: `cancelCorrection` still refreshes only `loadMyCorrections()`; `confirmCancelWorkArea` still refreshes only `loadMyWorkAreaRequests({ pageNumber: current })`. Both were verified in tests to leave the other workflow's loader uncalled.

## Independent pagination behavior

`myCorrectionsPage`/`myCorrectionsPageSize` and `myWorkAreaRequestsPage`/`myWorkAreaRequestsPageSize` remain separate store signals, untouched by this change. A test sets both pages to different values, switches tabs twice, and asserts both page numbers are unchanged — tab switching is purely a local UI signal change and never touches store paging state.

## Accessibility behavior

The tab row has `role="tablist"` with `aria-label="My requests"`. Each tab is a `role="tab"` `<button>` with a stable `id` (`my-requests-tab-corrections` / `my-requests-tab-work-area`), `aria-controls` pointing at its panel, and `[attr.aria-selected]` bound to the active tab. Each panel has `role="tabpanel"`, a stable `id`, and `aria-labelledby` pointing back at its tab. Both tabs use plain, always-focusable `<button>` elements (`tabindex="0"`), so Tab-key navigation and native Enter/Space activation work without any custom key handling. Arrow-key switching was deliberately **not** added: the only other tab pattern in this codebase (`employee-list.component.html`) has no arrow-key handling either, and a roving-tabindex implementation without matching focus movement would create a focus-trap bug (flagged during design review) — a plain two-button tablist meets the stated Tab/Enter/Space requirement without that risk. The active tab is distinguished by both a filled-pill background (existing convention, shared with the MY/TEAM toggle) and an increased `font-weight` on the active label, plus a `:focus-visible` outline using `var(--color-focus-ring)`, so selection is not conveyed by color alone.

## Responsive behavior

Because the `personal-attendance-grid` two-column CSS grid was removed, both "My attendance history" and "My requests" are now full-width flex-column children at every breakpoint — there is no side-by-side arrangement to collapse on small screens. The tab list itself uses `max-width:100%;overflow-x:auto`, so on narrow viewports it can scroll horizontally instead of truncating or wrapping tab labels, without causing page-level horizontal overflow. Each tab's table continues to use the pre-existing `.table-scroll` responsive-table pattern.

## Test counts

| Command | Result |
|---|---|
| `npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"` | **Passed:** 7 test files, 129 tests (was 108 before this change; +21 new tests: 3 in the store spec, 18 in the component spec). |
| `npx ng test --no-watch` (complete suite) | **Passed:** 195 test files, 1,515 tests (was 1,494 before this change; +21, matching the attendance-suite delta). |

## Production build result

`npm run build` completed successfully (exit code 0). Existing CommonJS-dependency and stylesheet-budget warnings were emitted for unrelated files (`checklist-builder`, `position-template-drawer`, `position-tree-node`, `bulk-onboarding`, the `qrcode` and `i18n-iso-countries` packages) — none of them are files touched by this task, and `time-tracking.component.css` does not appear in the budget-warning list (final size 7.8 kB, under the 8 kB error threshold).

## `git diff --check` result

`git --no-pager diff --check` against the files touched by this task exited with code `0`. It emitted only LF→CRLF conversion notices (the same benign notice documented in the prior `WORK_AREA_CHANGE_REQUEST_FRONTEND_HARDENING_REPORT.md`), no whitespace errors.

## Skipped checks

- Explicit tests for "no attendance endpoint is called once per request row" and "backend ordering is preserved within each request type" were not added as dedicated tests — both are true by inspection (the templates iterate the store's arrays with `@for` and never call a per-row loader), and are already indirectly covered by the existing "prevents duplicate in-flight action calls" pattern at the store level.
- "Duplicate action submission remains blocked" for correction/work-area cancel was not re-tested here — it is enforced by the pre-existing `runCorrectionAction`/`runWorkAreaMutation` in-flight guards in the store, which are outside the scope of this consolidation and already covered by the store's existing `clockIn` duplicate-call test.
- The browser/E2E suite, live backend integration, and manual accessibility audit (e.g. screen-reader pass) were not run; only local unit/component tests and the production build were used, consistent with the verification gates named for this task.

## Remaining risks

- The tab's active-state visual cue relies on a background-fill + font-weight combination rather than a dedicated icon/underline; this matches the existing MY/TEAM toggle convention in this same component but has not been run through a contrast/colour-blindness audit.
- `time-tracking.component.css` is now at 7.8 kB against an 8 kB error budget (95%); any future CSS addition to this file will need a small offsetting cleanup to stay under budget.

## Confirmations

- No backend files were modified; the backend repository was not touched.
- Nothing was staged, committed, or pushed. `git status --short --branch` continues to show the same pre-existing set of modified/untracked files from before this task, now including the edits listed above, all unstaged.
