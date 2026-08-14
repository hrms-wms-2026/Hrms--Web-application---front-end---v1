# Employee Onboarding — Finalized Draft Frontend Fix Report

## Root cause

Two independent frontend gaps let a finalized onboarding draft keep behaving like an active one:

1. **No terminal-draft concept existed in the frontend.** Nothing checked `status === 'finalized'`
   or `draftReason === 'invitation_sent'` before rendering a "Continue Draft" action or before
   counting a draft as "active" in the Onboarding Drafts tab. Every draft the backend listed was
   treated as actionable, so a finalized draft still showed "Continue Draft," and clicking it sent
   the user into the wizard where any Save/Finalize call hit the backend's
   `"This draft has already been finalized."` error.

2. **`AddEmployeeWizardStore` is `providedIn: 'root'` and survives route navigation**, but
   `AddEmployeeWizardComponent`'s constructor only read `route.snapshot.queryParamMap` once and
   never reset the store when no `draftId` was present. After finalizing a draft (which sets
   `finalizeResult`, `lastSaveStatus: 'finalized'`, `lastSaveReason: 'invitation_sent'`, `draftId`,
   `version` on the singleton store), clicking **+ Add Employee** again reused that same store
   instance with all of that stale terminal state still attached. Nothing in the wizard component
   distinguished "fresh draft" state from "leftover finalized draft" state.

There was no backend bug to work around — the backend's `finalized` / `invitation_sent` signals
were always present in the API responses; the frontend simply never consulted them for UI
gating.

## Terminal / finalized draft rule

A draft is **terminal** when either is true:
- `status === 'finalized'`
- `draftReason === 'invitation_sent'`

(the OR matters: a draft's `draftReason` can flip to `invitation_sent` slightly ahead of `status`
flipping to `finalized`, so both signals must independently gate the UI.)

Implemented once as `isTerminalDraft(status, draftReason)` in
[`src/app/modules/people/utils/draft-status.utils.ts`](src/app/modules/people/utils/draft-status.utils.ts)
and reused everywhere terminal status matters — no duplicated logic.

## Files changed

| File | Change |
|---|---|
| `src/app/modules/people/utils/draft-status.utils.ts` *(new)* | `isTerminalDraft()` predicate. |
| `src/app/modules/people/utils/draft-status.utils.spec.ts` *(new)* | Unit tests for the predicate. |
| `src/app/modules/people/ui/draft-table/draft-table.component.ts` | Added `isTerminal(draft)` helper. |
| `src/app/modules/people/ui/draft-table/draft-table.component.html` | Terminal rows render a disabled "Finalized" button instead of "Continue Draft"; non-terminal rows keep the existing `employees:write`-gated "Continue Draft" button unchanged. |
| `src/app/modules/people/ui/draft-table/draft-table.component.css` | `.draft-action-btn--disabled` style (muted, non-interactive). |
| `src/app/modules/people/ui/draft-table/draft-table.component.spec.ts` | New tests: finalized draft hides Continue Draft / shows Finalized; `invitation_sent` reason hides it even if `status` hasn't flipped; draft/waiting_for_seat/waiting_for_position_approval still render Continue Draft. |
| `src/app/modules/people/state/people.store.ts` | Added `withComputed` → `actionableDrafts` (filters `drafts` through `isTerminalDraft`). Backend contract (`drafts`, `loadDrafts`) untouched — filtering is display-only, in the frontend state layer, per the task's constraint. |
| `src/app/modules/people/state/people.store.spec.ts` | New test asserting `actionableDrafts` excludes finalized and invitation-sent items while `drafts` still holds the full backend list. |
| `src/app/modules/people/feature/employee-list/employee-list.component.html` | Onboarding Drafts tab badge and `<app-draft-table>` now bind to `store.actionableDrafts()` instead of `store.drafts()`. |
| `src/app/modules/people/feature/employee-list/employee-list.component.spec.ts` | New tests: count/table exclude finalized/invitation-sent drafts; Add Employee link never carries a `draftId` (was already true, now locked in by a regression test). |
| `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` | (a) Constructor now calls `store.reset()` before anything else when no `draftId` query param is present, then reloads work modes / company-driven departments as before. (b) Added `resumedDraftIsFinalized` computed via `isTerminalDraft(store.lastSaveStatus(), store.lastSaveReason())`. (c) `onFinalize()`'s `invitationQueued && !positionApprovalPending` success branch now `await`s `router.navigate(...)` **before** calling `store.reset()`. (d) Imported `RouterLink` for the new "Back to Employees" link. |
| `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html` | Added a branch between the "resuming" loader and the normal wizard body: when `resumedDraftIsFinalized()` is true, renders `app-empty-state` with "This onboarding has already been finalized." plus a "Back to Employees" link, instead of the step switch / Save Draft / Finalize buttons. |
| `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts` | New tests: (1) opening Add Employee with no `draftId` resets stale `finalizeResult`/`lastSaveReason`/`draftId` left by an earlier finalize in the same session; (2) resuming a `draftId` whose fetched draft is `finalized`/`invitation_sent` shows the safe message and hides Save Draft / Finalize; (3) a successful finalize with `invitationQueued && !positionApprovalPending` clears the store and navigates to `/people/employees`, with a microtask-based ordering check proving `reset()` runs only after `navigate()` settles (see below). |

Backend contract, DTOs, and endpoints were not modified. `saveDraft`/`finalizeDraft` requests are
unchanged; the fix is entirely display/state gating on the frontend.

## Behavior after the fix

- **Draft table**: terminal rows show a disabled "Finalized" label; no click path reaches the
  wizard for a terminal draft from the table.
- **Onboarding Drafts tab**: count and rows reflect only actionable (non-terminal) drafts, even
  though `PeopleStore.drafts` still holds whatever the backend returned (nothing hidden from the
  underlying state, only from the two display sites).
- **+ Add Employee**: always starts clean — stale `draftId`, `version`, `lastSaveStatus`,
  `lastSaveReason`, `finalizeResult`, `saveError`, `finalizeError`, `resumeError`, form values,
  company/department/position selections are all wiped via `reset()` before work modes are
  reloaded and the company-selection effect runs.
- **Direct URL to a finalized draft** (`/people/employees/new?draftId=<finalized>`): after the
  resume call completes, the wizard renders "This onboarding has already been finalized." with a
  link back to Employees — no Save Draft / Finalize buttons, no blank editable review screen.
- **Post-finalize (invitation queued)**: unchanged success toast + navigate to
  `/people/employees`, now additionally followed by `store.reset()` **after** the navigation
  promise settles (not fire-and-forget), so a subsequent Add Employee visit is guaranteed clean
  even if the constructor-level reset were ever bypassed. This ordering matters: the wizard
  component is still mounted — and its company-selection `effect()` still live — until navigation
  actually completes. Resetting first (nulling `companyId`) while that effect is still watching
  would make it see `companyId` diverge from the still-selected company and re-fire
  `setCompany()` → `loadDepartmentsForCompany()`, issuing a stray HTTP request from a component
  that's mid-teardown. Awaiting navigation first means the component (and its effect) is torn
  down before `reset()` runs, so nothing observes the change. Caught during self-review with an
  advisor pass before this report was finalized; the corresponding spec's ordering assertion was
  verified to fail on the un-awaited version and pass on the fixed version.
- **Onboarding Drafts list stays fresh after finalize**: `EmployeeListComponent` calls
  `loadEmployees`/`loadDrafts` from its constructor, and it's a routed, `loadComponent`-loaded
  page — navigating back to `/people/employees` after finalize creates a fresh instance of it
  (distinct route from `/people/employees/new`, so Angular's default route reuse strategy does
  not reuse the old instance), which re-issues both loads automatically. No explicit refresh call
  was needed in the wizard's finalize handler.
- **positionApprovalPending / waiting_for_seat / seat_configuration_required**: unchanged —
  these remain non-terminal by design (`isTerminalDraft` returns `false` for all of them), so the
  existing "keep as actionable draft, show safe message" behavior was not touched.

## Tests run

```
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
```
Result: **8 test files, 73 tests, all passed** (includes the 2 new spec files and the additions
to the 4 existing spec files listed above; no pre-existing people-module test was changed in a
way that altered its assertions, only new tests were added).

```
npm run build
```
Result: **succeeded**. Only pre-existing CSS budget warnings (unrelated components:
`landing-feature-tabs`, `landing-header`, `role-permissions-modal`, `landing-bento-grid`,
`position-template-drawer`, `date-picker`, `role-form-modal`, `department-management`,
`position-coverage-modal`, `landing-hero`, `general-settings`, `position-management`,
`position-tree-node`) and the pre-existing `i18n-iso-countries` CommonJS notice — none introduced
by this change, none in a file this task touched.

```
git diff --check
```
Result: **exit code 0**. Output only lists `LF will be replaced by CRLF` autocrlf notices (a
pre-existing repo/Git config characteristic on this Windows checkout, present across both files
this task touched and files it didn't), not actual trailing-whitespace or mixed-indentation
errors.

## Skipped checks

- No E2E/Playwright run (`npm run e2e`) — out of the requested verification scope (step 8 only
  asked for the two `ng`/`npm` commands and `git diff --check` above).
- No manual browser walkthrough was performed in this session; verification is via the automated
  spec suite only, per the requested checks.

## Remaining risks

- `AddEmployeeWizardStore.reset()` is called synchronously in the constructor when no `draftId`
  is present; this is correct for the "+ Add Employee" fresh-start path and for the observed
  problem case (singleton store reused across a same-tab navigation to a `draftId`-less route),
  but if any other current or future code path constructs `AddEmployeeWizardComponent` while
  intentionally relying on pre-populated non-draft state (none found in this codebase today),
  that state would now also be cleared.
- The "Back to Employees" empty-state screen for a directly-opened finalized draft is a
  **display-only, frontend gate** — it does not call any backend cancel/delete endpoint and does
  not change the draft's backend status. If the backend ever returns `finalized` from `getDraft`
  without also setting `draftReason` in a way `isTerminalDraft` recognizes, this screen would not
  trigger; the underlying backend error ("This draft has already been finalized.") would still be
  the safety net for any Save/Finalize attempt that slips through, per "Backend remains
  authoritative" in the task instructions.
- `positionApprovalPending` and `waiting_for_seat`/`seat_configuration_required` finalize
  responses were intentionally left non-terminal and their existing navigate/notify behavior was
  not modified beyond what already existed, per the task's explicit instructions for those cases.
- **Narrow stale-state edge case, left as-is**: the constructor only calls `store.reset()` when
  `draftId` is absent. If a user opens `?draftId=<finalized-A>`, goes back to the list, then
  clicks Continue Draft on a *different* draft `<B>` whose `resumeDraft()` call then fails
  (network error, 404, etc.), `lastSaveStatus`/`lastSaveReason` from draft A were never
  overwritten (the failed `resumeDraft()` only patches `resuming`/`resumeError`), so
  `resumedDraftIsFinalized()` would still read as true and the safe "already finalized" message
  would show for draft B instead of - or alongside - the real resume-failure toast. This is a
  three-step, low-likelihood sequence and the real error is still surfaced via
  `notificationService.error(resumeError)`; it was not closed in this pass since doing so cleanly
  would mean making the constructor's `reset()` unconditional (safe, since `resumeDraft()`
  otherwise repopulates every field it reads), which is a slightly larger behavioral change than
  the task's explicit ask. Flagging for a follow-up if it matters in practice.

## Confirmations

- **No backend files were edited.** All changes are under
  `Hrms--Web-application---front-end---v1/src/app/modules/people/` and one shared import addition
  (`RouterLink` from `@angular/router`, already a project dependency). No file outside this
  frontend repository was touched.
- **No commits or pushes were made.** All changes remain as uncommitted working-tree
  modifications; `git status` shows them as `M`/`??` only, on the pre-existing
  `feature/employee-management-phase1-foundation` branch, alongside unrelated pre-existing WIP
  (design-refresh files) that this task did not touch.
