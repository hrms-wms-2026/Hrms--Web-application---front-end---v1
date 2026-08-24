# Checklist Templates — Frontend Part 1 Report

## Repeated checklist API call fix

### Symptom

Navigating to **People → Checklists** caused the frontend to repeatedly call:

```
GET /api/v1/people/checklist-templates?legalEntityId=...&includeInactive=false&page=1&pageSize=25
```

Backend logs showed repeated 200 responses followed immediately by another identical request.

### Root cause

Confirmed by reading the actual source (not assumed) in `checklist-templates.component.ts` and `checklist-template.store.ts`:

1. **Double dispatch from the same signal change.** `ChecklistTemplatesComponent`'s constructor `effect()` reads `selectedCompany()`, `activeTypeTab()`, and `includeInactive()` and calls `store.setFilters(...)` whenever any of them change. But `setTypeTab()` and `toggleIncludeInactive()` *also* called `store.setFilters(...)` explicitly, with the same computed filter object, in the same method that mutates `activeTypeTab`/`includeInactive`. Writing those signals schedules the effect to re-run (Angular effects run asynchronously after the signal write), so every tab click or "include archived" toggle produced **two** identical `setFilters()` calls: one synchronous (explicit), one from the effect's subsequent re-run.
2. **No idempotency guard in the store.** `ChecklistTemplateStore.setFilters()` unconditionally `patchState`'d the filters and called `loadTemplates()` on every invocation, regardless of whether the resulting filters actually differed from the current ones. So the double dispatch from (1) always turned into two real HTTP GETs — matching the "repeated 200 responses followed immediately by another identical request" symptom exactly.
3. **No request sequencing.** Unlike `PeopleStore` (`people.store.ts`), `loadTemplates()` had no `requestId` guard, so an older in-flight response could resolve after a newer one and clobber state with stale data if two loads ever overlapped.

This is a pure frontend defect: the backend was returning correct, single responses to each request it received — the frontend was simply issuing the request twice per user action.

**Ruled out: a continuous entry-time loop from an upstream signal.** Before accepting the double-dispatch explanation as complete, I checked whether something upstream of `selectedCompany()` could keep emitting a new reference on every idle change-detection cycle (which would explain the report's wording "gets stuck" rather than just "double-fires on click"). Three checks, in order of directness:
- `LegalEntityStore.selectedLegalEntity` is a `computed(() => companies().find(...))`. It only recomputes when `companies` or `selectedLegalEntityId` actually change, and its only production write path (`CompanySelectorComponent.ngOnInit`) is guarded by `!this.store.loaded() && !this.store.loading()`, so `loadCompanies()` fires at most once per app session.
- Repo-wide search found no `setInterval`/`interval(...)` anywhere near the legal-entity or checklist code (the one hit, in `landing-feature-tabs.component.ts`, is an unrelated public marketing carousel).
- Added `checklist-templates.component.no-loop.spec.ts`, which drives the component through the **real** (unmocked) `LegalEntityStore` end-to-end — a real `loadCompanies()` HTTP response, a real `selectedLegalEntity` computed — then runs 8 additional idle `fixture.detectChanges()` cycles and asserts zero further list calls. This passed, confirming the real computed chain is reference-stable and cannot be the source of a page-entry loop.

Together these rule out an upstream re-emission source. The double-dispatch mechanism (effect + explicit handler both firing `setFilters` per click/toggle) is the complete explanation for the reported behavior.

### Files changed

All within `Hrms--Web-application---front-end---v1`, no backend files touched:

- `src/app/modules/people/state/checklist-template.store.ts`
  - Added a pure `areFiltersEqual()` comparison over every `ChecklistTemplateListParams` field.
  - `setFilters()` now merges the incoming partial filters, compares against current state, and is a **no-op** (no `patchState`, no `loadTemplates()` call) when nothing actually changed.
  - `loadTemplates()` now uses a closure-scoped `loadRequestId` counter (same pattern as `PeopleStore.loadEmployees`/`loadDrafts`) so a stale response arriving after a newer request cannot overwrite current state.
  - The synchronous "no `legalEntityId`" early-return branch still bumps `loadRequestId` (to invalidate any prior in-flight request) but no longer carries a redundant `requestId !== loadRequestId` check on that same synchronous path — that check could never be true there.
- `src/app/modules/people/feature/checklist-templates/checklist-templates.component.ts`
  - Removed the duplicate explicit `store.setFilters(...)` calls from `setTypeTab()` and `toggleIncludeInactive()` — they now only update their own local signals.
  - Added a private `buildFilters()` that centralizes filter construction from `selectedCompany()` / `activeTypeTab()` / `includeInactive()`.
  - The constructor `effect()` is now the **single** call site for `store.setFilters()`, calling it with `buildFilters()`'s result. Combined with the store's idempotency guard, this is defense-in-depth: even if the effect and a manual retry happened to overlap, the store would still de-duplicate.
  - `loadTemplates()` (used by the "Retry" button on `app-error-state`) is unchanged — it still calls `store.loadTemplates()` directly, bypassing `setFilters`, so a manual retry always issues a fresh request even when filters are unchanged.

### Tests added/updated

`src/app/modules/people/state/checklist-template.store.spec.ts`:
- `setFilters with unchanged filters does not call the API again`
- `setFilters with changed templateType calls the API exactly once`
- `setFilters with changed includeInactive calls the API exactly once`
- `loadTemplates ignores a stale older response when a newer request is already in flight`
- `loadTemplates does not call the API when legalEntityId is missing`

`src/app/modules/people/feature/checklist-templates/checklist-templates.component.spec.ts`:
- `initial selected company triggers exactly one list call`
- `changing type tab triggers exactly one list call`
- `toggling include inactive triggers exactly one list call`
- `repeated change detection does not trigger additional identical list calls (regression: no request-loop)` — this is the test that directly catches the reported regression: it changes a filter, flushes the resulting request, then runs several extra `fixture.detectChanges()` cycles with nothing changed and asserts zero further requests.

`src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts` (new file):
- `idle change detection after a real company load does not re-trigger the list call` — drives the component through the real, unmocked `LegalEntityStore` chain (see root-cause section above) to rule out an upstream re-emission source for the loop.

Also fixed, while touching this spec file:
- The `beforeEach` didn't flush the component's initial mount request, so every test failed `httpMock.verify()`. Added the flush (matching the pattern already used in `general-settings.component.spec.ts`).
- `shows Create Checklist button...` (pre-existing test, not part of this bug): `canManage` is an Angular `computed()` that reads a *spied* (`vi.spyOn(...).mockReturnValue/mockImplementation`) `PermissionService.hasPermission`, which has no signal dependency. Re-spying mid-test and calling `fixture.detectChanges()` again can never invalidate the computed's cached value — this would have failed identically against the original, untouched component. Fixed by creating a fresh component instance (and resetting the singleton `ChecklistTemplateStore`, since it's `providedIn: 'root'` and otherwise already holds matching filters from the first fixture's mount, which the idempotency guard would then correctly treat as unchanged). This is a test-only fix, unrelated to the API-loop root cause, called out here for transparency rather than silently bundled in.

### Verification results

```
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
```
→ **13 test files, 98 tests, all passing.**

```
npm run build
```
→ **Succeeded.** Only pre-existing CSS budget warnings (unrelated components: role-permissions-modal, position-tree-node, department-management, date-picker, etc.) and a pre-existing CommonJS warning for `i18n-iso-countries` — none introduced by this change.

```
git diff --check
```
→ Exit 0. No whitespace/conflict-marker errors in any file touched by this fix (pre-existing LF→CRLF warnings on unrelated files, not touched here, are informational only).

### Confirmation: backend was not edited

No files under any backend project/solution were read or modified. All changes are confined to `Hrms--Web-application---front-end---v1/src/app/modules/people/state/checklist-template.store.ts`, `checklist-template.store.spec.ts`, `checklist-templates.component.ts`, `checklist-templates.component.spec.ts`, and the new `checklist-templates.component.no-loop.spec.ts`.

### Confirmation: no commits or pushes were made

No `git add`, `git commit`, or `git push` commands were run. `git status --short --branch` still shows the same pre-existing modified/untracked files as before this task, with the checklist-templates files reflecting the in-progress (uncommitted) edits made here.

## Archived template UI removal

### Why archived templates are not shown in tenant UI

Archived and deactivated checklist templates are retained by the backend strictly for audit trails and historical safety (e.g. tracking completed onboarding tasks assigned against legacy templates). They are not intended to function as a user-facing recycle bin or active management list for HR users. Because there is no restore/reactivate workflow in the tenant HR user interface, exposing a "Show archived templates" checkbox in the UI adds confusion and misrepresents archived items as recoverable or toggleable templates. Therefore, the tenant-facing HR checklist template view exclusively lists active templates.

### Files changed

All within `Hrms--Web-application---front-end---v1`, no backend files touched:

- `src/app/modules/people/feature/checklist-templates/checklist-templates.component.html`
  - Removed the "Show archived templates" checkbox element and label.
  - Updated empty state component title binding to dynamic `emptyStateTitle()` and description to `"Create a checklist template to standardize employee onboarding or offboarding tasks."`.
- `src/app/modules/people/feature/checklist-templates/checklist-templates.component.ts`
  - Removed `includeInactive` signal state and `toggleIncludeInactive()` handler.
  - Added `emptyStateTitle` computed signal that returns:
    - `"No checklist templates have been created yet."` when viewing all templates.
    - `"No onboarding checklist templates have been created yet."` when filtering by onboarding.
    - `"No offboarding checklist templates have been created yet."` when filtering by offboarding.
  - Updated `buildFilters()` to consistently set `includeInactive: false` on all outgoing API query filter requests.
- `src/app/modules/people/feature/checklist-templates/checklist-templates.component.spec.ts`
  - Added unit test asserting `"Show archived templates"` checkbox is not rendered.
  - Added unit test verifying initial load sends `includeInactive=false` query parameter.
  - Added unit test verifying tab switching sends `includeInactive=false` query parameter.
  - Added unit test asserting no UI path sends `includeInactive=true`.
  - Added unit tests for empty state title and description copy across default ('all'), 'onboarding', and 'offboarding' tab selections.
- `src/app/modules/people/state/checklist-template.store.spec.ts`
  - Updated store test description to clarify API filter contract support for `includeInactive`.

### Tests run

1. `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`
2. `npm run build`
3. `git diff --check`

### Confirmation: backend was not edited

No backend code, controller, repository, or database schema files were touched. All modifications were strictly confined to the Angular frontend repository at `C:\onevoNew\Hrms--Web-application---front-end---v1`.

### Confirmation: no commits or pushes were made

No `git commit`, `git add`, or `git push` commands were executed. All changes remain local and uncommitted.

## Checklist form UX correction

### Overview

Corrected the Create/Edit Checklist Template form UX to use HR-friendly terminology and product-driven task assignment flow, eliminating technical backend controls and terminology from the user interface while preserving strict backend payload compatibility.

### Removed technical UI

Removed the following backend-centric controls and technical labels from the create/edit template UI:
- **“Scope Level”** label
- **“Company / Default”**, **“Department-specific”**, and **“Position-specific”** option labels
- **“Assignee Category”** label
- **“HR Representative”**, **“IT Support”**, and **“Specific User”** options
- Direct UI exposure of raw backend `ownerType` string choices

### Final user-facing flow

1. **Checklist Details**:
   - Template Name (text input)
   - Template Type (Onboarding / Offboarding chips)
2. **Applicability (“Apply this checklist to”)**:
   - **“All employees in this company”**: Applies checklist globally across legal entity.
   - **“A department”**: Displays Department selector.
   - **“A position”**: Displays Department selector first, followed by Position selector filtered by selected department.
3. **Task Definition & Assignment**:
   - Task Title
   - **Responsible Party**:
     - **“New employee”**: Self-task assigned to the new hire (e.g. upload documents, complete profile).
     - **“Existing employee in a position”**: Task assigned to a specific role/position in the company.
   - **Responsible Position**: Selects position from current company/department context.
   - **Responsible Employee**: Displays position employee assignment status (or disabled state when endpoint is unavailable).
   - **Due Offset (Days)**: Relative day offset from hire start date.
   - **Required Task**: Toggle flag.

### Internal backend payload mapping

The form maps user-facing selections to backend contract requirements:
- **Checklist Applicability**:
  - “All employees in this company” → `legalEntityId` set, `departmentId: null`, `positionId: null`
  - “A department” → `legalEntityId` set, `departmentId` set, `positionId: null`
  - “A position” → `legalEntityId` set, `departmentId` set, `positionId` set
- **Task Assignment**:
  - “New employee” → `ownerType: "employee"`, `assignedToId: null`, `assigneePositionId: null`
  - “Existing employee in a position” → `ownerType: "custom_user"` (internal), `assignedToId` set to selected concrete user, `assigneePositionId` set to selected position
- **Task Scheduling & Rules**:
  - `dueOffsetDays` (integer offset, never concrete `dueDate`)
  - `sequence` (1-indexed based on task order in list)
  - `isRequired` (boolean)

### Endpoint dependency check: Employee-by-position picker

- **Check result**: Inspected frontend API services (`PeopleApiService`, `PositionApiService`, `DepartmentApiService`). The frontend does **not** currently have a backend endpoint to query active employees filtered by `positionId`.
- **Implementation handling**: No fake/mock assignees are generated or populated in the UI. When an existing employee in a position is selected, the responsible employee control safely displays:
  `“Employee picker by position is not available yet.”`
- **Backend recommendation**: To complete full concrete user assignment by position in the form, backend should expose `GET /api/v1/org/legal-entities/{legalEntityId}/positions/{positionId}/occupants` or allow filtering `GET /api/v1/employees?positionId={positionId}`.

### Tests run

1. **Angular Unit Tests**:
   - `npx ng test --no-watch`
   - **89 test files, 628 tests, 100% passing.**
   - Verified specific assertions:
     - Form does not render "Scope Level", "Assignee Category", or "Specific User"
     - Form renders "Apply this checklist to", "All employees in this company", "A department", "A position"
     - Task card renders "Responsible party" with "New employee" and "Existing employee in a position"
     - "New employee" selection emits payload with `ownerType: "employee"` and `assignedToId: null`
     - Existing employee selection emits payload with `assignedToId` set and no technical UI labels
     - Task removal omits task from payload
     - `dueOffsetDays` is emitted, not `dueDate`
     - Checkbox maps to `isRequired`
     - Position empty state renders safely without fake assignees and triggers OnPush change detection via `ChangeDetectorRef`
     - Create and Edit modals open cleanly and emit backend-compatible payloads

2. **Production Build**:
   - `npm run build`
   - **Succeeded with zero compilation errors.**

3. **Git Code Health**:
   - `git diff --check`
   - **Exit code 0 (no conflict markers or whitespace errors).**

### Skipped checks

- None. All required build and test verification steps were executed and passed.

### Remaining risks

1. **Concrete User Assignment for Tasks**: Because backend does not yet provide a GET employees-by-position endpoint, user-assigned template tasks fallback to selecting position with `assignedToId` preserved if editing, but cannot pick new concrete occupants until backend adds an occupant lookup endpoint.
2. **Template Type Immutability**: Editing an existing template cannot change `templateType` or `legalEntityId` per backend API rule.

### Confirmation: backend was not edited

- Confirmed: No files under `C:\onevoNew\HRMS-Backend-v1` were modified or touched.

### Confirmation: no commits or pushes were made

- Confirmed: No `git commit`, `git add`, or `git push` commands were executed. All changes remain local working-tree modifications.


