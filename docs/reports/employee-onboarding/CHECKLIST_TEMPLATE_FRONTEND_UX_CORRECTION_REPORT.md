# Checklist Template Frontend UX Correction Report

Scope: `src/app/modules/people/feature/checklist-builder/` and related model/tests. No backend,
onboarding finalization, position management, settings, or auth changes.

## Update (this pass)

The previous pass (see sections below, largely unchanged) already delivered the full-page
builder, the corrected Employee / Company position assignment model, and the compact task-row
layout. One real bug was found and fixed. A "Required" column and a due-field suffix were
briefly added to match stale wording still left in this doc's Task-list UX table, then reverted
on correction: their removal from the UI (`isRequired` stays a payload-only field with no row
toggle; the due field stays a bare number input) was a deliberate prior decision, not a gap. The
doc's Task-list UX table below has been corrected to match — it previously still listed both,
which is what caused the incorrect re-add.

1. **Edit-mode round-trip bug (real defect, now fixed).** `ChecklistTemplateTaskResponse` never
   returns `assigneePositionId` — the backend resolves a position to a concrete `assignedToId` at
   save time and only that id comes back. Loading a saved "Company position" task therefore always
   populated an empty `assigneePositionId` control. Combined with the "Company position requires
   assignee position" validation rule, opening a saved template and pressing Save **without
   touching anything** would fail validation with no way to satisfy it short of re-picking a
   position the UI can't tell HR they need to re-pick. Fixed by carrying the loaded `assignedToId`
   through in a new hidden `originalAssignedToId` form control: validation treats it as satisfying
   "assignee present," and submit resends it unchanged (`assignedToId: <original>`,
   `assigneePositionId: null`) unless HR actively picks a new position, in which case the new
   `assigneePositionId` takes priority and the carried-over id is dropped. See
   `mapTaskFormToRequest` / `validateTaskAssignees` in `checklist-builder.component.ts`.

## Corrected assignee model

Each task row exposes **Assigned to** with two HR-facing options:

| UI option | Meaning | Payload |
|-----------|---------|---------|
| **Employee** | Task is assigned to the employee being onboarded/offboarded | `ownerType: "employee"`, `assignedToId: null`, `assigneePositionId: null` |
| **Company position** | Task is assigned to whoever currently holds the selected company position | `ownerType: "custom_user"`, `assignedToId: null`, `assigneePositionId: <position id>` |

Forbidden in UI: "New employee", "Existing employee", "Someone else", "Responsible party", and
backend terms like `ownerType` / `custom_user` / `assignedToId`.

When **Company position** is selected, an **Assignee position** dropdown appears (all company
positions loaded once via the existing position API — no employee/person picker).

## Checklist applicability vs task assignee

These are separate concepts:

- **Use this checklist for** (applicability / scope): Company default, Department, or Position.
  Controls which `departmentId` / `positionId` are sent on the template itself.
- **Assigned to** (per-task assignee): Employee or Company position.
  Controls each task's `ownerType`, `assignedToId`, and `assigneePositionId`.

Scope rules unchanged:

- Company default → `departmentId: null`, `positionId: null`
- Department → `departmentId` required, `positionId: null`
- Position → both `departmentId` and `positionId` required

## Backend task payload mapping

Verified against:

- `CreateChecklistTemplateCommand` / `UpdateChecklistTemplateCommand` task inputs
- `ChecklistTemplateTaskRequest` API contract
- `ChecklistTemplateTaskInputResolver`

**Employee assignment**

```json
{
  "ownerType": "employee",
  "assignedToId": null,
  "assigneePositionId": null,
  "dueOffsetDays": 0
}
```

**Company position assignment**

```json
{
  "ownerType": "custom_user",
  "assignedToId": null,
  "assigneePositionId": "<selected-position-guid>",
  "dueOffsetDays": 0
}
```

`custom_user` is the backend-supported non-employee owner type used when resolving assignees
via position (see backend tests and `ChecklistTaskOwnerTypes.CustomUser`).

## Backend position-only task assignee support

**Supported.** Create/Update commands accept `assigneePositionId` without `assignedToId`.
`ChecklistTemplateTaskInputResolver` resolves the position to the current position holder at
template save time via `IChecklistTemplateAssigneeResolver`.

**Caveat:** The template detail response (`ChecklistTemplateTaskResponse`) returns only
`assignedToId`, not `assigneePositionId`. On edit, non-employee tasks load as **Company position**
with the position dropdown empty — this is expected (the original position isn't knowable) and no
longer blocks saving: the loaded `assignedToId` is carried through unchanged unless HR actively
picks a new position (see "Update (this pass)" above).

## Task-list UX

Compact ClickUp/Plane-style rows inside the Tasks section:

| Column | Content |
|--------|---------|
| # | Sequence number |
| Task | Title input |
| Assigned to | Employee / Company position selector; assignee position dropdown when needed |
| Due | Bare `dueOffsetDays` number input (0 = start date) — no visible "Required" column or due-field suffix text; `isRequired` is still collected and sent in the payload, deliberately without a row-level control |
| Actions | Move up, move down, remove |

No nested grey boxes, no repeated helper paragraphs, no disabled fake controls.

## Tests run

```bash
npx ng test --no-watch --include "src/app/modules/people/**/*.spec.ts"
npm run build
git diff --check
```

(The `--include` glob is quoted — PowerShell/Bash would otherwise expand it before Angular's
Vitest-based `@angular/build:unit-test` builder sees it. `ng test` uses Vitest, not Jest, despite
the architecture doc's example config — confirmed via `angular.json`'s `test` builder and the
`vi.spyOn` calls already in the existing specs.)

Results: **13 test files / 123 tests passed** (up from 121 — 2 net new tests this pass, covering
the edit-mode round-trip fix; the Required/due-suffix column and its test were added and then
reverted along with the UI); build succeeded (only pre-existing, unrelated CSS budget warnings —
this component's CSS is unchanged from before this pass); `git diff --check` clean (only benign
LF→CRLF autocrlf notices, no actual whitespace errors).

Two pre-existing `NG04002: Cannot match any routes` unhandled-rejection warnings appear in the
checklist-builder spec run — these come from the test's `provideRouter([])` not matching the
`/people/checklists` navigation target `cancel()`/`onSubmit()` call in tests; present before this
change too and don't fail any test.

Coverage in `checklist-builder.component.spec.ts` (additions this pass in **bold**):

- "Assigned to", "Employee", "Company position" render
- Forbidden labels do not render, including "Required" as a header/column and
  `"days after start date"` anywhere in the DOM — unchanged, restored after a brief incorrect
  reversal (see "Update (this pass)")
- Employee payload emits `ownerType: employee`, null assignee fields
- Company position requires assignee position; emits `assigneePositionId` + `ownerType: custom_user`
- Due validation (integer ≥ 0)
- Add/remove/reorder
- Scope validation and payload mapping
- Edit mode loads non-employee tasks as Company position; **assigneePositionId is empty and
  originalAssignedToId carries the loaded assignedToId**
- **Re-saving an untouched Company position task succeeds and resends the original
  `assignedToId` (no forced re-selection)**
- **Re-picking a position on a loaded Company position task overrides the carried-over assignee**
- `flushInitialRequests()` now asserts the department and assignee-position list calls each fire
  exactly once (was previously just flushing whatever matched, which passed even on duplicates)

## Skipped checks

- **No live browser verification.** The backend (`HRMS-Backend-v1`) was not running locally and
  starting it (plus tenant login/HTTPS setup) was outside this task's explicit verification list
  (`ng test`, `npm run build`, `git diff --check`). The layout/label changes are covered
  structurally by the specs above (header text, `.cb-due-field__suffix` content,
  `.cb-required-toggle` presence, checkbox change behavior) but were not visually inspected in a
  running app.

## Remaining risks

1. **Resolver at save time:** Backend resolves position → current holder when the template is
   saved, not dynamically at onboarding/offboarding runtime. If the position holder changes after
   template save, the stored `assignedToId` still reflects the holder at save time — re-saving an
   edited template (even untouched, per the fix above) does **not** re-resolve to the current
   holder, since the frontend carries the old `assignedToId` forward rather than re-sending
   `assigneePositionId`. HR must explicitly re-pick the position to force re-resolution. This is a
   frontend-only mitigation of a backend modeling limitation ("responsible person can change over
   time" is not actually true today at the stored-template level) — flagging as a backend
   contract gap, not fixing it, per this task's no-backend-changes constraint.
2. **Vacant positions:** If the selected position has no current holder, backend save may fail
   with a resolver error — the UI does not pre-validate occupancy.
3. **No per-task "Required" control in the UI.** `isRequired` is collected in the form and sent
   in every task payload, but there is no row-level toggle for HR to change it — it defaults to
   `true` for new tasks and otherwise carries whatever value a loaded template task had. This is
   deliberate (confirmed with the user), not an oversight.
