# Employee Onboarding Checklist Step 2 — Custom Tasks Report

Builds on the prior [Selection & Preview](EMPLOYEE_ONBOARDING_CHECKLIST_STEP2_SELECTION_PREVIEW_REPORT.md) pass. That pass made Step 2 selection unambiguous and added a read-only task preview. This pass replaces the read-only preview with an employee-specific, editable task panel, and removes an auto-selection behavior that violated the product requirement that HR must explicitly choose a checklist.

## Root Cause

Step 2 had two problems relative to the target behavior:

1. **Auto-selection.** `AddEmployeeWizardStore.loadChecklistTemplateMatches()` auto-selected the first returned match whenever nothing was already selected (`!previouslySelected && matches.length > 0 ? matches[0].id : null`). On a brand-new draft with exactly one matching checklist (a common case — a single company-default template), this silently pre-selected it before HR ever looked at it.
2. **No task customization.** The right panel (`.checklist-preview`) rendered the selected template's tasks read-only. There was no way to adjust a task's title, due timing, required flag, or assignee for this specific employee without editing the reusable template itself (which the task explicitly forbids) — and no state existed to hold employee-specific edits separately from the template.

## No-Auto-Selection Behavior

- `loadChecklistTemplateMatches()` now computes `nextSelectedId` as `stillValid ? previouslySelected : null` — the auto-select-first branch is gone entirely. A brand-new draft always lands on no selection, even with exactly one match.
- The only way `selectedTemplateId` becomes non-null without an explicit click is `resumeDraft()` restoring it from a previously-saved draft — the one case the task explicitly allows.
- The right panel's neutral state now reads: *"Select a checklist to preview and customize tasks for this employee."*

## Employee-Specific Task Copy Behavior

- `AddEmployeeWizardState` gained `draftTasks: readonly DraftChecklistTask[]` (the employee-specific, editable copy) and `draftTasksSourceTemplateId: string | null` (which template `draftTasks` currently reflects).
- Selecting a checklist (`selectChecklistTemplate`) clears `draftTasks` immediately, then a new `seedDraftTasksIfNeeded()` closure seeds `draftTasks` with an independent deep copy (`createDraftTasksFromTemplate` in `utils/draft-checklist-task.utils.ts`) once the template detail loads — from either the cache-hit branch or the HTTP-success branch of `loadSelectedTemplateDetail()` (both call it; missing the cache-hit branch was an early bug caught before implementation via a second-opinion review).
- All task edits (`updateDraftTask`, `addDraftTask`, `removeDraftTask`, `moveDraftTaskUp/Down`) replace array/object references — `selectedTemplateDetail().tasks` (and its entry in `templateDetailCache`) is never touched. Covered by a dedicated store test and a component test.
- **Resume must not clobber restored edits.** `resumeDraft()` parses `editedTasksJson` (if present) into `draftTasks` immediately and stamps `draftTasksSourceTemplateId` to the restored `selectedTemplateId` *before* the subsequent `loadChecklistTemplateMatches() → loadSelectedTemplateDetail()` call fires for the same id. `seedDraftTasksIfNeeded()` is a no-op whenever `draftTasksSourceTemplateId` already matches the template being loaded, so the detail-load triggered by resume never overwrites the restored edits. Verified by a test where the template's *current* tasks are deliberately different from the restored `editedTasksJson`, so an overwrite bug would be caught by the assertion instead of passing coincidentally.
- The checklist template itself is never mutated and never written back: the wizard calls `getChecklistTemplate` (GET) only — never `updateChecklistTemplate` (PUT) or `createChecklistTemplate` (POST). Verified by a store test that selects a checklist, edits a task, and saves the draft, then asserts no PUT/POST to the template endpoints occurred.

## `editedTasksJson` Contract Used

Determined by reading the backend directly (not guessed) — `ChecklistTaskJsonContract.Parse` in `HRMS-Backend-v1/src/ONEVO.Application/Features/CoreHr/Onboarding/Models/ChecklistTaskContract.cs`, and confirming `EfEmployeeChecklistTaskRepository.InstantiateAsync` passes `ChecklistTaskDueRuleMode.AbsoluteDate` whenever `editedTasksJson` is non-null (`SaveOnboardingDraftCommandHandler` itself does **not** validate the JSON shape at save time — it's stored as-is and only parsed at finalize):

```
editedTasksJson: JSON string, array of:
{
  title: string,
  ownerType: "employee" | "manager" | "hr" | "it" | "custom_user",
  assignedToId?: string (GUID)   // must be ABSENT when ownerType === "employee";
                                  // REQUIRED (a literal GUID) when ownerType !== "employee"
  dueDate: string (YYYY-MM-DD)   // an absolute date, not an offset - unlike the template's own TasksJson
  sequence?: number,
  isRequired: boolean
}
```

or `null` when no checklist is selected.

Two derived design points:

- **`dueDate` is computed, not stored.** The wizard UI collects a relative "Due after N days from employee start date" per the task spec, but the backend's edited-task contract wants a concrete date once HR has reviewed it against a real start date. `serializeDraftTasksToEditedTasksJson()` computes `dueDate = startDate + dueDays` using UTC-safe date arithmetic (`Date.UTC(...)`, not local `Date` math, which would shift a calendar day for users west of UTC). The inverse (`parseEditedTasksJsonToDraftTasks`) recomputes `dueDays = dueDate − startDate`, clamped to `0` if negative (defensive: a draft whose start date moved later than a previously-saved task's due date must not hydrate an invalid offset).
- **"Another person" has no safe contract and is disabled.** `ChecklistTaskJsonContract.Parse` only accepts a literal `assignedToId` GUID for non-employee tasks — it has no `assigneePositionId` field at all. The checklist **builder**'s "Company position" assignee picker (`assigneePositionId` → server-side resolution) only exists for template CRUD (a completely different endpoint/JSON, `ChecklistTemplateTaskRequest`/`TasksJson`); that resolution never runs against `EditedTasksJson`. Since the wizard has no picker that can produce a literal, real user GUID, the "Another person" option is rendered but `disabled`, with the required copy: *"Choosing another assignee is not available yet."* A task copied from the template that already carries a resolved non-employee `ownerType`/`assignedToId` keeps that assignment (`preservedOwnerType`/`preservedAssignedToId`) unchanged and passes it straight through on save; the only assignee transition the UI offers is switching such a task back to "Employee" (safe — it only requires dropping the preserved id).

## Files Changed

- `src/app/modules/people/models/checklist-template.model.ts` — added `DraftTaskAssignee` and `DraftChecklistTask`.
- `src/app/modules/people/utils/draft-checklist-task.utils.ts` (new) — `createEmptyDraftTask`, `createDraftTasksFromTemplate`, `serializeDraftTasksToEditedTasksJson`, `parseEditedTasksJsonToDraftTasks`, `validateDraftTasks`, and the UTC-safe `addDaysToIsoDate`/`diffDaysBetweenIsoDates` helpers.
- `src/app/modules/people/state/add-employee-wizard.store.ts` — added `draftTasks`/`draftTasksSourceTemplateId` state and `updateDraftTask`/`addDraftTask`/`removeDraftTask`/`moveDraftTaskUp`/`moveDraftTaskDown` methods; removed the auto-select-first-match branch from `loadChecklistTemplateMatches()`; added `seedDraftTasksIfNeeded()` (called from both branches of `loadSelectedTemplateDetail()`); `selectChecklistTemplate()`/`clearSelectedChecklistTemplate()`/`setCompany()`/`setDepartment()`/`setPosition()` now also clear `draftTasks`/`draftTasksSourceTemplateId`; `saveDraft()` now validates and serializes `draftTasks` into `editedTasksJson` (blocking the API call with a friendly `saveError` if validation fails, or if a checklist is selected but its tasks haven't finished loading yet); `resumeDraft()` now hydrates `draftTasks` from `editedTasksJson` when present.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` — removed the read-only `previewTasks`/`taskAssignedToLabel`/`taskDueLabel`; added task-row handlers (`onTaskTitleChange`, `onTaskDueDaysChange`, `onTaskRequiredChange`, `setTaskAssigneeToEmployee`, `addTask`, `removeTask`, `moveTaskUp`, `moveTaskDown`), row-level validation (`taskTitleError`, `taskDueDaysError`) gated by a new `taskSubmitAttempted` signal (mirrors the existing `submitAttempted` pattern for Step 1), and a `dueDaysRowErrors` signal for transient invalid-keystroke feedback; `goToNextStep()` now blocks advancing off Step 2 with a friendly inline error when a checklist is selected and its tasks fail validation; `onSaveDraft()`/`onFinalize()` now flag `taskSubmitAttempted`; `onFinalize()` now always calls `saveDraft()` first when a checklist is selected (even for an already-resumed draft with an existing `draftId`) so `editedTasksJson`/`selectedTemplateId` are flushed before finalize reads them — previously only a *missing* `draftId` forced a save first, which meant checklist edits made on Step 2 of a resumed draft could reach Finalize unsaved.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html` — neutral-state copy updated; the read-only task list replaced with editable rows (title `app-input`, assignee toggle, due-days number input + suffix, required checkbox, remove/reorder buttons) plus an "+ Add task" button.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.css` — removed the now-unused read-only `.checklist-preview__task*`/`__badge*` rules; added compact `.task-edit-icon-btn`/`.task-edit-assignee__btn`/`.task-edit-due__input` rules (shared declarations merged to stay under the 4kB component-style budget — the new panel's structural layout uses Tailwind utility classes directly in the template instead of bespoke CSS, matching how Step 1 of this same component is already styled).
- `src/app/modules/people/state/add-employee-wizard.store.spec.ts` — rewrote the auto-select test to assert no selection; updated the "does not overwrite an already-selected template" and "saveDraft sends the selected checklist template id" tests to select explicitly; added 9 new tests: no-auto-select-even-with-one-match, copies-template-tasks-into-draft-state, edit-does-not-mutate-template-detail, saveDraft-sends-editedTasksJson-from-edits, saveDraft-sends-null-editedTasksJson-when-unselected, switching-checklist-resets-tasks, resume-restores-selectedTemplateId-and-editedTasksJson, resume-does-not-overwrite-restored-edits, never-calls-template-write-APIs.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts` — reworked `advanceToChecklistStepWithOneMatch()` into two helpers (`advanceToChecklistStepUnselected` + an explicit-click variant), since selection is no longer automatic; updated 5 existing tests whose assumptions changed (matches-then-auto-detail-fetch flows); added 13 new tests covering neutral-state-by-default, no-default-card-selection, task-panel-appears-on-select, title/due/required/remove/add/reorder editing, due-days rejecting negative/decimal input, title-required validation blocking Continue, template-detail-not-mutated, and the internal-term DOM-leak check extended to also cover `assigneePositionId`/`sequence`.

**Not changed** (confirmed already correct, no edit needed):
- `src/app/modules/people/data-access/checklist-api.service.ts` / `.spec.ts` — the wizard already only calls `getChecklistTemplate` (GET) and `getOnboardingMatches`; it never called `updateChecklistTemplate`/`createChecklistTemplate` before this task and still doesn't. Confirmed by a new store-level test rather than a change to this file, since the file itself tests the service class in isolation, not a specific consumer.
- Backend — `SaveOnboardingDraftCommandHandler`/`FinalizeOnboardingDraftCommandHandler`/`ChecklistTaskJsonContract` already support everything the frontend needs (`editedTasksJson` is stored as-is at save time, parsed only at finalize); no backend change was required or made.

## Tests Run

```bash
npx ng test --no-watch --include "src/app/modules/people/**/*.spec.ts"
```
Result: **13 test files, 164 tests passed** (up from 147 before this pass — 17 net new tests).

```bash
npm run build
```
Result: **succeeded**, no bundle-budget error. `add-employee-wizard.component.css` was initially 44 bytes over its 4kB warning threshold after the new task-row styles were added; trimmed via shared-declaration merging until the warning cleared entirely. Remaining warnings are the same pre-existing, unrelated ones in other modules (landing page, position/role modals, date-picker, general-settings) plus the pre-existing non-ESM `i18n-iso-countries` notice.

```bash
git diff --check
```
Result: **no whitespace errors** — only benign LF→CRLF autocrlf notices.

## Skipped Checks

- **No live browser verification.** As in both prior passes, `HRMS-Backend-v1` was not running locally during this session; verification relied on the Angular/Vitest test suite (HTTP-mocked via `HttpTestingController`, asserting exact request bodies/URLs and resulting DOM states) and a production build, not driving the running app against a live dev tenant with a real checklist template and a real Save Draft → Resume → Finalize round trip.
- **2 pre-existing unhandled promise rejections** (`NG04002: Cannot match any routes. URL Segment: 'people/checklists'`) from `checklist-builder.component.spec.ts` still surface when running the full people-module suite together. Present before this task (per `git status` at the start of this session, that file was already modified/uncommitted), unrelated to this task's scope, and non-fatal — all 164 tests pass regardless.

## Remaining Risks

1. **`saveDraft()`'s "wait for checklist to finish loading" guard is untested.** If a user selects a checklist and immediately clicks Save Draft before the template detail request resolves, `store.saveDraft()` returns `null` with `saveError: 'Please wait for the checklist to finish loading before saving.'` instead of racing the load. This is a narrow timing window (detail requests are typically fast) and wasn't in the required test list, so it has no dedicated test — the logic mirrors the already-tested `draftTasksSourceTemplateId` invariant, but hasn't been exercised directly.
2. **A task that starts as "Another person" and is switched to "Employee" cannot be switched back** in the same session, by design — there is no picker to re-pick a concrete assignee. If HR does this by mistake, the only recovery is re-selecting the checklist (which re-seeds all tasks from the template, discarding any other edits made in the meantime) or manually re-adding an equivalent task. This is an inherent consequence of "Another person" having no real assignee-picker contract, not a bug, but is a rough edge worth a product follow-up if it comes up.
3. **`onFinalize()`'s always-save-when-checklist-selected change is scoped, not global.** Finalizing a *resumed* draft with **no** checklist selected still skips straight to the finalize call without re-saving first (preserving prior, tested behavior) — so any other field edited on Step 1/3 of a resumed draft without touching the checklist step still has the same pre-existing gap this task didn't ask to fix. Only the checklist-selection/editedTasksJson path was brought in line with requirement 5.
4. **No i18n/copy review** was requested or performed for the new strings ("Select a checklist to preview and customize tasks for this employee.", "Choosing another assignee is not available yet.", "Enter a whole number of days, 0 or more.", "A title is required.") — they follow the existing copy style used elsewhere in this wizard.
