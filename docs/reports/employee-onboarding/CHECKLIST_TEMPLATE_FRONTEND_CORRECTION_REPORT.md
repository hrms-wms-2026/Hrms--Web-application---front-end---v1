# Checklist Template Frontend Correction Report

Corrects the product language and task-assignment UX in the checklist template form
(`src/app/modules/people/ui/checklist-template-form/`). Scope: frontend only, this
component + its model file. No backend, onboarding finalization, position management,
settings, company/legal-entity, or auth code was touched.

## What wrong UI was removed

- Section label **"Responsible party"** → replaced with **"Assigned to"**.
- Option label **"New employee"** → replaced with **"Employee"**.
- Option label **"Existing employee in a position"** → replaced with **"Responsible person"**.
- The `RESPONSIBLE_PARTY_OPTIONS` constant and `ResponsiblePartyType` type were removed
  and replaced with `ASSIGNMENT_OPTIONS` / `ChecklistTaskAssignmentType`.
- The `responsibleParty` form field was renamed to `assignmentType`; the field that used
  to sit unused as `assignedToId` is now `responsiblePersonId` (still maps to the
  backend's `assignedToId`, never rendered as a raw backend name).
- Removed the unused `CHECKLIST_OWNER_TYPE_LABELS` export from
  `checklist-template.model.ts`, which hard-coded the fake role categories **"HR
  Representative"**, **"IT Support"**, **"Manager"**, and **"Specific User"**. It had no
  callers anywhere in the app, so deleting it is a pure cleanup with no behavior change.
- The message shown when a position is chosen for "Responsible person" was corrected
  from "Employee picker by position is not available yet." to the exact required
  wording: **"Person selection by position is not available yet."**

No backend names (`ownerType`, `custom_user`, `assignedToId`, `assigneePositionId`,
"existing employee") are rendered anywhere in the template. Verified by an explicit
negative-assertion test.

## Exact product wording now used

- Field label: **"Assigned to"**
- Options: **"Employee"**, **"Responsible person"**
- When "Responsible person" is chosen: **"Responsible position"** (select), **"Responsible
  person"** (info box)
- Fallback message: **"Person selection by position is not available yet."**
- For a task that already has a resolved person from a prior save: **"Already assigned
  to a specific person from a previous save."**

## Backend fields mapped internally

- "Employee" → `ownerType: "employee"`, `assignedToId: null`, `assigneePositionId: null`.
- "Responsible person" → `ownerType: "custom_user"`, `assignedToId: <resolved person>`,
  `assigneePositionId: <chosen position, only when no person is yet resolved>`.

## Person-by-position selection: blocked, by design, not by backend limitation

There is **no frontend-facing endpoint** to list employees/users assigned to a given
position (checked `PositionsController` and `EmployeesController` — neither exposes an
occupant list; `EmployeesController.List` has no `positionId` filter). Per the task's
explicit instruction, the UI does **not** fake this with a full employee dropdown. When
"Responsible person" is chosen, a `responsiblePositionId` and `responsiblePersonId` are
both required; since there is no control to populate `responsiblePersonId`, the task
(and therefore the whole form) stays invalid and submit is blocked, with the friendly
message shown in place of a picker.

**Important nuance for whoever picks this up next:** the backend *can already* resolve
a position to a single concrete person server-side.
`ChecklistTemplateAssigneeResolver` (used by both Create and Update template handlers)
accepts `assigneePositionId` alone, resolves it to the position's single active
occupant, and returns a clear 422 if there are zero or multiple occupants. So a
"pick a position, let the backend resolve the person" flow could be made fully
functional today with no new endpoint, by simply not blocking submission and letting
`assigneePositionId` reach the API. That was **not** implemented here — the task's
instructions were explicit and conditional ("if no endpoint exists to list people by a
position, disable and block"), and no such *listing* endpoint exists, so the block
stands. This is a deliberate product/UX decision this correction preserves, not a
technical constraint — worth a conscious call from product/HR stakeholders on which
flow they actually want.

## Edit-mode bug found and fixed mid-task

`ChecklistTemplateTaskResponse` (what the backend returns for an existing template) has
**no `assigneePositionId` field** — only the already-resolved `assignedToId` is ever
persisted and returned; the position used at creation time is not stored. The original
implementation of this fix required `responsiblePositionId` on *any* `custom_user` task,
including ones restored from a saved template that already had a concrete
`assignedToId` and no position. That meant:

1. Opening any existing template with a `custom_user` task for editing would show a
   "Responsible position is required" error the user never caused, blocking saves of
   templates that were already valid.
2. If the user picked a position to satisfy that, the payload would carry **both**
   `assignedToId` and `assigneePositionId` — which `ChecklistTemplateTaskInputResolver`
   explicitly rejects with a 422 ("Provide either assignedToId or assigneePositionId,
   not both").

Fixed: a task that already has a resolved `responsiblePersonId` and no pending
position selection is treated as already-assigned and does **not** require a
responsible position — it submits unchanged (`assignedToId` carried through,
`assigneePositionId: null`). Choosing a *new* responsible position on such a task
clears the previously-resolved person (since there is still no picker to re-resolve
it) and re-blocks submission, consistent with the "no fake picker" rule. This was
caught by an advisor review before being shipped and is covered by two new tests.

## Due offset days validation gap found and fixed mid-task

A second advisor review caught that "Due offset days is required and must be a
non-negative integer" was only half-enforced: `Validators.min(0)` alone lets a
non-integer like `2.5` through (it does not check integrality), and the reactive form
has no `novalidate`-defeating HTML validation to fall back on (Angular puts
`novalidate` on the form, so the `min="0"` attribute never fires). A non-integer value
would have reached the payload and hit the backend's `int DueOffsetDays` deserialization
as a raw 400. Separately, this field was the only one in the form with no `[error]`
binding, no `*` on its label, and no `submitAttempted()` message — an invalid value
silently blocked submit with nothing shown on screen, the exact class of "send nothing
instead of a friendly message" failure the task's validation rules exist to prevent.

Fixed: added a `nonNegativeIntegerValidator` alongside `Validators.min(0)`, added the
`*` to the label, and added a `submitAttempted()`-gated error span
("Due offset days must be a whole number of 0 or more.") matching the pattern already
used for Responsible position. Covered by two new tests that go through the same
string-based `(input)` → `setValue` path the template uses (not `patchValue` with a
number), since that's what the original 114 passing tests didn't exercise.

## Tests run

- `npx ng test --no-watch --include "src/app/modules/people/ui/checklist-template-form/**/*.spec.ts"` — 14/14 pass.
- `npx ng test --no-watch --include "src/app/modules/people/**/*.spec.ts"` — 116/116 pass (full people module, no regressions).
- `npm run build` — succeeds (only pre-existing, unrelated CSS/CommonJS warnings on other components).
- `git diff --check` on the changed files — clean, no whitespace errors.

All new/changed tests were written and confirmed **RED** (failing for the expected
reason: missing method / wrong wording) before implementation, then confirmed **GREEN**
per TDD.

## Skipped checks

- **No live browser verification against a running backend/tenant.** Exact wording was
  verified via rendered `textContent` assertions in the component's unit tests instead.
  A frontend dev server was found already running locally, but exercising the real flow
  requires an authenticated tenant session (login, `employees:write`/`org:manage`
  permissions) which was out of scope to set up for a text/validation-logic correction
  already fully covered by unit tests.
- No E2E/Playwright coverage was added or run (none pre-existed for this component).

## Remaining risks

- The "Responsible person" assignment path is currently **unusable for new
  assignments** by design (always blocked, per instructions) until either (a) a
  position-occupant-listing endpoint is added, or (b) product decides to accept the
  already-working position-only resolution described above and the frontend is
  updated to stop blocking on it.
- If a future change adds a real employee-by-position picker, the validator logic in
  `applyAssignmentValidators`/`onResponsiblePositionChange` should be revisited — it
  currently assumes "position selected → no trustworthy person" as an invariant.
- `ChecklistTaskOwnerType` still includes `manager`/`hr`/`it` (backend-supported,
  informational-only owner types per `ChecklistTaskOwnerTypes` doc comment). This UI
  intentionally exposes only `employee`/`custom_user`, per the instruction not to show
  fake role categories unless asked for. Any existing template task saved with
  `manager`/`hr`/`it` (unlikely, since nothing in this app writes those values) would
  render as "Responsible person" with a locked/no-op person id — no crash, but not
  distinguished in the UI from `custom_user`.
- `addTask()` is a public method typed to accept a `Partial<ChecklistTemplateTaskRequest>`,
  which includes `assigneePositionId`. If a future caller ever passed both
  `assigneePositionId` and `assignedToId` at once, `hasResolvedPerson` would evaluate
  false (position present) yet `responsiblePersonId` would already hold a value and
  both controls would validate as satisfied — producing a payload with both ids set,
  which the backend rejects. Currently unreachable (the template-restore effect never
  passes `assigneePositionId`, and `ChecklistTemplateTaskResponse` has no such field),
  so the invariant holds by construction of today's only caller, not by a guard in
  `addTask()` itself. Worth a defensive check if `addTask()` grows more callers.
