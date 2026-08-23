# Employee Onboarding Position Vacancy Frontend Report

## Root cause

The Add Employee onboarding wizard mapped position responses to plain name-only select options and did not validate vacancy before progressing or submitting. That meant fully occupied positions were indistinguishable from available ones in the UI, remained selectable, and could leave stale checklist/template state attached after a position became invalid on refresh.

## Files changed

- `src/app/modules/people/state/add-employee-wizard.store.ts`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`
- `src/app/modules/people/state/add-employee-wizard.store.spec.ts`
- `src/app/shared/ui/select/select.component.spec.ts`
- `docs/superpowers/plans/next/2026-08-20-employee-onboarding-position-vacancy.md`

## Exact vacancy calculation used

- `availableSeats = maxOccupancy - assignedCount`
- `isFull = availableSeats <= 0`

## API fields relied on

- `id`
- `name`
- `maxOccupancy`
- `assignedCount`
- `reportsToPositionId`
- `departmentId`
- `isActive`

## Behavioral changes

- The position dropdown continues showing all active positions for the selected legal entity and department.
- Available positions now render with concise labels such as `Software Engineer [2]`.
- Full positions now render with concise labels such as `Project Manager [No vacancy]`.
- Full positions are disabled in the shared select option model and cannot be selected through the UI.
- Continue, Save Draft, and Finalize now block on inline position validation when the selected position is missing, invalid, or full.
- If a previously selected position becomes full after reload, onboarding clears the position selection, clears the selected checklist template, clears edited checklist tasks, and stores the friendly inline message: `The selected position no longer has a vacancy. Choose another position.`

## Tests run

- `npx ng test --no-watch --include src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts --include src/app/shared/ui/select/select.component.spec.ts`
- `npx ng test --no-watch --include src/app/modules/people/state/add-employee-wizard.store.spec.ts`
- `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`
- `npm run build`
- `git diff --check`

## Skipped checks

- None.

## Remaining risks

- Vacancy enforcement depends on the backend continuing to supply authoritative `assignedCount` and `maxOccupancy` values on the position list response used by onboarding.
- The current shared control is a native `<select>`, so only the whole option can be styled; the bracketed count text is explicit but not independently highlighted inside the native option row.
- `npm run build` succeeds, but the workspace still has pre-existing non-blocking Angular warnings and style budget warnings outside this change.
