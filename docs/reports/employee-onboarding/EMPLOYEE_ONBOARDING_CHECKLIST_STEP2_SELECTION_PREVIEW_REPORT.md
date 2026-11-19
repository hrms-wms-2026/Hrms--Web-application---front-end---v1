# Employee Onboarding Checklist Step 2 — Selection & Preview Report

Builds on the prior [Employee Onboarding Checklist Match Fix](EMPLOYEE_ONBOARDING_CHECKLIST_MATCH_FIX_REPORT.md), which already wired Step 2 to load matching checklist templates. This pass makes selection unambiguous and adds a task-review preview, without touching the backend or the checklist builder.

## Root Cause

Step 2 rendered matches as a flat list of bordered buttons with only a color/border change on selection, and the right half of the page was empty — there was no way to see what a checklist actually contained before continuing. Specifically:

1. `checklist-template-option` cards had no non-color selected indicator and no `radiogroup`-appropriate visual affordance beyond a border tint.
2. `AddEmployeeWizardStore` had no state or method for loading a single template's detail (`GET /people/checklist-templates/{id}`) — only the list-of-matches endpoint was wired up.
3. Step 2's markup was a single `max-w-2xl` column; there was no layout for a review panel.
4. Clearing the checklist selection when department/position changed lived only in the component (`onDepartmentChange`/`onPositionChange`, gated on `store.step() === 'checklist_template'`), so it wasn't guaranteed by the store itself.

## Files Changed

- `src/app/modules/people/state/add-employee-wizard.store.ts` — added `selectedTemplateDetail`, `loadingSelectedTemplateDetail`, `selectedTemplateDetailError`, `templateDetailCache` state; added `loadSelectedTemplateDetail(id)` (cache-first, with an in-flight-request guard so a second call for the same id while the first is still pending never fires a duplicate HTTP request); `selectChecklistTemplate()` now loads detail for the newly selected id (no-ops if the id is already selected); `clearSelectedChecklistTemplate()` now also clears detail state; `loadChecklistTemplateMatches()` now validates a previously-selected id against the new matches (clears it if it's no longer present, instead of only ever keeping-or-auto-selecting-first) and triggers a detail load for whatever id ends up selected; `setCompany()`, `setDepartment()`, `setPosition()` now clear `selectedTemplateId`/`selectedTemplateDetail` directly, so Step-1 changes invalidate the checklist selection unconditionally rather than relying on the component to do it only while Step 2 is active. Confirmed via grep that `onPositionChange` is the only production caller of `setPosition()`, so this clearing is strictly additive. `setDepartment`/`setPosition` clearing is covered by new tests; `setCompany`'s clearing is not separately tested (company changes mid-wizard are not a flow exercised elsewhere in the existing suite either) but follows the identical, already-tested pattern.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` — added `previewTemplateTypeLabel`, `previewApplicabilityLabel`, `previewTasks` (sorted by `sequence`), `taskAssignedToLabel`, `taskDueLabel`, `retrySelectedTemplateDetail()`; `onDepartmentChange`/`onPositionChange` no longer call `clearSelectedChecklistTemplate()` directly since the store now does it as part of `setDepartment`/`setPosition`.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html` — Step 2 is now a two-column grid (`.checklist-step-grid`): left column is the reworked checklist cards (`.checklist-card`, renamed from `.checklist-template-option`) with a radio-dot/check-icon indicator; right column is the new `.checklist-preview` panel with its own loading/error/empty/populated states.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.css` — added the two-column grid (collapses to one column ≤900px), card styles, and preview panel styles (sticky, matching the pattern already used in `general-settings` and `position-management`), all via existing theme tokens (`--color-border`, `--color-surface`, `--color-accent`, `--color-text-primary/secondary`, `--color-focus-ring`, `--color-surface-secondary`); trimmed a few duplicate rule blocks (shared `:focus-visible` selector, merged `__meta`/`__task-meta` base rules) to keep the file under the 4kB component-CSS budget.
- `src/app/modules/people/state/add-employee-wizard.store.spec.ts` — 5 new tests (select-stores-id-and-loads-detail, no-repeat-fetch-for-same-id, safe error on detail failure, department-change clears selection+detail, position-change clears selection+detail); 4 existing tests updated to flush the new detail request they now trigger.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts` — 7 new tests (visible selected state, right-panel populated preview, tasks rendered in sequence order with assignee/due/required labels, zero-tasks checklist renders a clean "0 tasks" header with no task rows, no raw backend field names *or* raw backend values in the DOM, neutral message with no selection, no continuous detail requests); 3 existing tests updated for the renamed `.checklist-card` selector and the new detail-fetch flush; the existing "does not repeatedly call the matches endpoint" test now also asserts no repeat detail call.

**Not changed** (confirmed already correct, no edit needed):
- `src/app/modules/people/data-access/checklist-api.service.ts` / `.spec.ts` — `getChecklistTemplate(id)` already existed and is already tested (`getChecklistTemplate sends GET request to endpoint by id`); `getOnboardingMatches` was already typed as `OnboardingChecklistTemplateMatchResponse[]` from the prior pass. Both spec requirements listed in the task ("`getChecklistTemplate(id)` is used for detail preview", "`getOnboardingMatches` remains correctly typed") are satisfied by existing coverage.
- `src/app/modules/people/models/checklist-template.model.ts` — `ChecklistTemplateDetailResponse` / `ChecklistTemplateTaskResponse` already carried every field the preview needs (`name`, `templateType`, `departmentName`, `positionName`, `tasks[].sequence/title/ownerType/dueOffsetDays/isRequired`).

## Endpoint Contract Used

```
GET {environment.apiUrl}/people/checklist-templates/{id}

Response: ChecklistTemplateDetailResponse
  { id, name, templateType: 'onboarding' | 'offboarding', legalEntityId,
    departmentId, departmentName, positionId, positionName, isActive,
    tasks: { title, ownerType, assignedToId, dueOffsetDays, sequence, isRequired }[] }
```

`selectedTemplateId` continues to flow through `saveDraft()` unchanged from the prior pass; `editedTasksJson` is untouched (still always `null`), per the task's explicit instruction not to introduce it.

## UX Behavior

- **Left column**: each match is a `role="radio"` card. Clicking anywhere on the card selects it. The selected card gets an accent border + tinted background *and* a check-icon in a filled radio dot (not color alone), plus `aria-checked`.
- **Match label**: `company` → "Company default", `department` → "Department match", `position` → "Position match" (unchanged from the prior pass).
- **Right column** (`.checklist-preview`, sticky):
  - No selection → "Select a checklist to preview its tasks, or continue without one."
  - Detail loading → `app-loader`.
  - Detail error → inline message + Retry (re-fetches; no cache entry was written on failure, so retry always re-hits the API).
  - Loaded → checklist name, `Onboarding`/`Offboarding` type, applicability (`Company default` / `Department — {name}` / `Position — {name}`), task count, and an ordered task list (sorted by `sequence`).
  - Each task row shows: title; assignee (`Employee` for `ownerType: 'employee'`, otherwise the safe fallback `Assigned person` — the backend response has no assignee-name field, so no name is invented); due (`Start date` / `1 day after start date` / `N days after start date`); a `Required`/`Optional` badge.
  - No raw backend identifiers (`ownerType`, `assignedToId`, `dueOffsetDays`, `editedTasksJson`, `matchLevel`) appear anywhere in the rendered DOM — covered by an explicit test.
- **Continue** remains available with no checklist selected — confirmed unchanged from the prior pass's backend read: `SaveOnboardingDraftCommandValidator` has no rule for `selectedTemplateId`, and `FinalizeOnboardingDraftCommandHandler` skips checklist-task instantiation when it's null.
- Task editing is out of scope here and was not added — the preview is read-only.

## Tests Run

```bash
npx ng test --no-watch --include "src/app/modules/people/**/*.spec.ts"
```
Result: **13 test files, 147 tests passed** (up from 135 in the prior pass — 12 net new tests this pass).

```bash
npm run build
```
Result: **succeeded**. The new CSS initially pushed `add-employee-wizard.component.css` 102 bytes over its 4kB component-style budget; trimmed via de-duplication (shared `:focus-visible` rule, merged `__meta`/`__task-meta` base styles) until the warning cleared. Remaining warnings are the same pre-existing, unrelated ones from other modules (landing page, role/position modals, etc.) plus the pre-existing non-ESM `i18n-iso-countries` notice.

```bash
git diff --check
```
Result: **no whitespace errors** — only benign LF→CRLF autocrlf notices.

## Skipped Checks

- **No live browser verification.** `HRMS-Backend-v1` was not running locally; verification relied on the Vitest/Angular test suite (HTTP-mocked via `HttpTestingController`, asserting exact request URLs/params and resulting DOM states) and a production build. The prior pass's report notes the same limitation.
- The two pre-existing `NG04002: Cannot match any routes. URL Segment: 'people/checklists'` unhandled-rejection warnings from `checklist-builder.component.spec.ts` still appear when running the full people-module suite — present before this task, unrelated to it (out of scope per the task's checklist-builder restriction), and non-fatal (all 146 tests pass).

## Remaining Risks

1. **`Assigned person` is a permanent fallback, not a temporary gap.** `ChecklistTemplateTaskResponse` has no assignee-name field today, so any non-employee task (owner type `it`, `hr`, `manager`, `custom_user`) will always show the generic fallback rather than a real name, even though the checklist builder's "Company position" assignment does resolve to a concrete person server-side at save time. If a future backend change adds a resolved name to the detail response, `taskAssignedToLabel()` in the component is the single place to update.
2. **Auto-selection edge case.** When a previously-selected template id is no longer present in a freshly-loaded matches list (e.g. matches changed for a reason other than a department/position edit going through the store's own clearing logic), the store clears the selection to `null` rather than falling back to auto-selecting the first available match. This matches the task's explicit requirement ("if selectedTemplateId no longer exists in returned matches, clear it") but means the neutral "Select a checklist…" message could appear even when matches exist, if that path is ever reached outside the normal Step-1-edit flow (which now clears the selection *before* reloading matches, so in practice this branch is defensive, not currently reachable through the UI — same caveat the prior report noted for the department/position clearing logic).
3. **No i18n/copy review** was requested or performed for the new Step 2 preview strings ("Select a checklist to preview its tasks, or continue without one.", "Loading checklist details…", the applicability/type/due labels) — they follow the existing copy style used elsewhere in the wizard.
