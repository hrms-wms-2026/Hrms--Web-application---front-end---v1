# Employee Onboarding Checklist Match Fix Report

## Root Cause

Add Employee Step 2 always showed "Checklist templates are not yet available" even when
People → Checklists had an active company-default onboarding checklist, because:

1. **Step 2 HTML was hardcoded** (`add-employee-wizard.component.html`) to always render the
   `app-empty-state` "not yet available" block for the `checklist_template` step — there was no
   conditional logic reading store state at all.
2. **`AddEmployeeWizardStore` had unused state** (`checklistTemplates`, `checklistTemplatesUnavailable`)
   but no method that ever called `GET /api/v1/onboarding/checklist-templates/matches`, so the state
   was never populated.
3. **`saveDraft()` always sent `selectedTemplateId: null`**, hardcoded, so even a manual selection
   (had the UI supported one) would never reach the backend.
4. **`ChecklistApiService.getOnboardingMatches()` was typed as `ChecklistTemplateListItemResponse[]`**
   (the shape of `/people/checklist-templates`), but the matches endpoint actually returns
   `OnboardingChecklistTemplateMatchResponse[]` (`id`, `name`, `matchLevel`, `departmentId`,
   `positionId`) — the URL and query params were already correct, only the response typing was wrong,
   which meant no code could safely consume `matchLevel` for a friendly label.

The backend was verified (read-only) to confirm `selectedTemplateId` is optional on both save and
finalize (`SaveOnboardingDraftCommandValidator` has no rule for it; `FinalizeOnboardingDraftCommandHandler`
skips checklist-task instantiation when it's null but finalizes normally) — so Step 2 does not block
"Continue" or "Finalize" when no checklist is selected, matching existing product behavior.

## Files Changed

- `src/app/modules/people/models/checklist-template.model.ts` — added `ChecklistTemplateMatchLevel`
  and `OnboardingChecklistTemplateMatchResponse`.
- `src/app/modules/people/data-access/checklist-api.service.ts` — `getOnboardingMatches()` now returns
  `Observable<readonly OnboardingChecklistTemplateMatchResponse[]>`.
- `src/app/modules/people/data-access/checklist-api.service.spec.ts` — added a test for the matches
  endpoint's URL/params/typed response.
- `src/app/modules/people/state/add-employee-wizard.store.ts` — added `checklistTemplateMatches`,
  `selectedTemplateId`, `loadingChecklistTemplates`, `checklistTemplatesError` state;
  `loadChecklistTemplateMatches()`, `selectChecklistTemplate()`, `clearSelectedChecklistTemplate()`
  methods; `saveDraft()` now sends `store.selectedTemplateId()`; `resumeDraft()` restores
  `selectedTemplateId` from the draft and loads matches for the draft's legal entity/department/position.
- `src/app/modules/people/state/add-employee-wizard.store.spec.ts` — added tests for match loading
  (populate, empty, error, no-company-safe-noop, auto-select-first, don't-overwrite-existing-selection),
  `saveDraft` sending `selectedTemplateId`, and `resumeDraft` restoring it + loading matches.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` — calls
  `loadChecklistTemplateMatches()` when advancing into `checklist_template` after Step 1 validation
  passes (via `goToNextStep()`); clears the selection and reloads if department/position change while
  on that step; dedupes requests with a `${companyId}|${departmentId}|${positionId}` key so re-renders
  of Step 2 never re-fire the call; added `matchLevelLabel()` and `selectChecklistTemplate()`.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html` — Step 2 now
  renders loading / error+retry / empty (only when not loading, no error, and truly unavailable) /
  selectable checklist list states instead of a hardcoded empty state.
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts` — added
  tests: matches load on Step 2 entry, empty state only shows for an empty response, selection updates
  `selectedTemplateId`, no repeated/duplicate calls on re-render; updated two existing resumed-draft
  tests to flush the new matches request the resume flow now issues.

## Endpoint Contract Used

```
GET {environment.apiUrl}/onboarding/checklist-templates/matches
  ?legalEntityId={required}
  &departmentId={optional}
  &positionId={optional}

Response: OnboardingChecklistTemplateMatchResponse[]
  { id: string; name: string; matchLevel: 'company' | 'department' | 'position';
    departmentId: string | null; positionId: string | null }
```

Friendly labels rendered in the UI: `company` → "Company default", `department` → "Department match",
`position` → "Position match".

## Tests Run

```
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
```
Result: **13 test files, 135 tests passed.**

```
npm run build
```
Result: **succeeded** (only pre-existing, unrelated CSS-budget warnings in other modules and an
existing non-ESM third-party module warning).

```
git diff --check
```
Result: **no whitespace errors** (only benign LF→CRLF line-ending notices from git's autocrlf config,
not actual diff problems).

## Skipped Checks

- **Live browser verification** was not performed — this fix was verified via the Angular/Vitest test
  suite (HTTP-mocked) and a production build only, not by driving the running app against a live dev
  tenant with a real onboarding checklist template. The store/component tests do assert the exact
  request URL/params and the resulting DOM states (loading/error/empty/populated), which is the same
  contract a live run would exercise.
- **2 pre-existing unhandled promise rejections** (`NG04002: Cannot match any routes. URL Segment:
  'people/checklists'`) surface from `checklist-builder.component.spec.ts` when running the full people
  module suite together. That file was already modified (uncommitted) before this task started per
  `git status`, is unrelated to the onboarding-checklist-match fix, and is explicitly out of scope
  ("Do not redesign the whole checklist builder in this task"). All 135 tests still pass; these are
  noisy but non-fatal.

## Remaining Risks

- `clearSelectedChecklistTemplate()` + reload-on-department/position-change in the component only fires
  when `store.step() === 'checklist_template'` at the moment `onDepartmentChange`/`onPositionChange` are
  called. In the current UI, department/position selects only render on Step 1 (`employee_details`), so
  this branch is currently unreachable through normal navigation — it's defensive/future-proofing per
  the task spec's explicit requirement, not exercised by a live user flow today.
- Selecting a checklist template is optional and unvalidated by design (confirmed against backend
  validators), so a user can save/finalize with no checklist selected — this preserves existing product
  behavior but was not something this task was asked to change.
- No new i18n/copy review was requested or performed for the new Step 2 strings ("Loading checklist
  templates…", match-level labels, etc.) — they follow the existing copy style used elsewhere in the
  wizard (e.g. "Loading departments…").
