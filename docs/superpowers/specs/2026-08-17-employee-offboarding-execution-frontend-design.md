# Employee Offboarding Execution — Frontend Design

**Status:** Approved by user 2026-08-17, ready for implementation planning.

**Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-employee-offboarding-execution-backend-design.md` (backend half — this document is the frontend consumer of that API, §6 there is the shared contract).

**Origin:** brainstormed live with the user 2026-08-17 via `superpowers:brainstorming`, from a 6-step offboarding flow image, with the explicit requirement that entry is via an action button on the employee-detail screen (not sidebar-only). Cross-checked against the actual current codebase — see §2.

---

## 1. Goal

A routed, 6-step offboarding wizard (Start Offboarding → Choose Exit Checklist → Review Tasks → Track Exit Work → Complete or Bypass Tasks → Complete Employee Exit), reached from the employee-detail screen, plus the offboarding-specific extensions to the existing checklist-template builder that the flow depends on.

## 2. Current-state facts this design depends on

- **The entry point already has a stub**: [`employee-detail.component.ts:101`](../../../src/app/modules/people/feature/employee-detail/employee-detail.component.ts) — inside the "Change Position" popover (`data-testid="offboarding-menu-item"`), next to Promotion/Transfer, currently `disabled title="Not yet available"`. This design enables it and points it at the new wizard route instead of `openChangePosition(...)`.
- **`ChangePositionModalComponent`** (`src/app/modules/people/ui/change-position-modal/`) is the only sibling UX pattern that exists today, and it's a single-step modal — not a fit for 6 steps with per-step data loads, a task list, and an approval inbox. This design uses a routed page instead (`/people/employees/:id/offboarding`), not a modal.
- **No standalone "onboarding wizard" exists, but `AddEmployeeWizardComponent`** (`src/app/modules/people/feature/add-employee-wizard/`) **is a real multi-step wizard precedent** — it defines its own step state rather than using any shared stepper component (none exists anywhere under `src/app/shared/ui`, confirmed by directory listing and a repo-wide glob for `*stepper*`): a `WizardStep` union type (in `../../models/onboarding-draft.model.ts`), module-level `STEP_ORDER`/`STEP_LABELS` constants, and the current step held as state in its own SignalStore (`store.step()`/`store.goToStep(next)`), with `stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()))` driving which step's markup renders. The offboarding wizard follows this exact shape (its own `OffboardingWizardStep` union + `STEP_ORDER`/`STEP_LABELS` + step state in a new `OffboardingWizardStore`), not a shared component, since none exists to reuse.
- **The checklist template management UI already exists and already distinguishes onboarding/offboarding**: `checklist-templates.component.ts` has an `activeTypeTab` signal (`'all'|'onboarding'|'offboarding'`) for the list view, and `checklist-builder.component.ts` already has a `templateType` form control (defaults `'onboarding'`, user-selectable) and a per-task `isRequired` checkbox in its `FormArray`. Per the user's explicit instruction, this design **extends `checklist-builder.component.ts`** with the offboarding-only bypass/penalty/category fields — it does not build a new template editor.
- **`checklist-template.model.ts`** already types `ChecklistTemplateType = 'onboarding' | 'offboarding'` and the task request/response DTOs — this design adds `isBypassable`, `bypassPenaltyDescription`, `category` to `ChecklistTemplateTaskRequest`/`Response` (all optional, matching the backend's optional/default-false fields).
- **`checklist-api.service.ts`** is the existing HTTP client for template CRUD — a new sibling service (or an extension, TBD at plan time) is needed for the employee-checklist-task and offboarding-record endpoints, since no frontend code touches `employee_checklist_tasks` today (confirmed no backend controller exists for it either — see backend spec §3).

## 3. Scope

**In scope:** the offboarding wizard (6 routed steps), enabling the employee-detail stub, extending `checklist-builder.component.ts`/`.html` with offboarding-only task fields, a small "My Approvals" surface for bypass decisions.

**Out of scope:** any onboarding-side frontend work (no onboarding wizard exists and none is built here), a new template-authoring shell (extends the existing one only), file upload on tasks, computed settlement amounts (backend spec §2 — Payroll is Phase 2).

## 4. Checklist builder extension

In `checklist-builder.component.ts`'s per-task `FormGroup` (built inside `addTask()`, alongside the existing `isRequired: [existing?.isRequired ?? true]` control), add three controls — rendered only when `form.controls.templateType.value === 'offboarding'`, following the same runtime-conditional pattern the component already uses for its assignee field: a getter method (mirroring `isCompanyPositionAssignment(taskGroup)`) checked in an `@if` block in the template. `mapTaskFormToRequest(...)` and the `ChecklistTaskFormValue` interface must also grow all three fields, or they're silently dropped on submit — these are the two other end-to-end touch points, not just the form/template pair.

- `isBypassable: boolean` (checkbox, default `false`)
- `bypassPenaltyDescription: string | null` (text input, shown only when `isBypassable` is checked)
- `category: 'asset_return' | 'access_removal' | 'document_handover' | 'final_settlement' | 'knowledge_handover' | 'other' | null` (select)

Submitted as part of the existing `tasks` array payload to `POST/PUT /checklist-templates` — no new endpoint, just wider request/response DTOs (backend spec §4.2).

## 5. Offboarding wizard

Route: `/people/employees/:id/offboarding` (new feature module `src/app/modules/people/feature/offboarding/`, following this codebase's existing feature/data-access/state layering). A step indicator matches the image's 6 numbered steps; each step is its own routed child or a signal-driven step index within one shell component (decide at implementation-plan time based on how much per-step deep-linking/back-button behavior is wanted — both are consistent with this codebase's Angular 21 patterns).

1. **Start Offboarding** — form: last working day, exit reason (select: resignation/termination/retirement/contract_end), rehire eligibility (select), knowledge risk level (select), notes (textarea). Submits `POST /api/v1/employees/{id}/offboarding`.
2. **Choose Exit Checklist** — radio list of matching active offboarding templates (name + match level, mirroring the `AddEmployeeWizardComponent`'s existing template-selection step — the closest real precedent in this codebase, per §2). Submits `POST /api/v1/employees/{id}/offboarding/select-checklist`.
3. **Review Tasks** — editable list (owner, due date, required toggle) over the instantiated tasks. `PATCH` per edited task.
4. **Track Exit Work** — read-only progress view grouped by `category` (Assets Returned / Access Removed / Documents Handover / Final Settlement / Knowledge Handover / Other), overall percent bar, matching the image's "Progress Overview."
5. **Complete or Bypass Tasks** — per-task Complete button; Bypass button opens a small form (reason, penalty — prefilled from the task's `bypassPenaltyDescription`, editable, "None" allowed, approver picker scoped to users holding `employees:write`). Inline list of this offboarding's pending bypass requests.
6. **Complete Employee Exit** — summary/review, disabled until every required task is `completed`/`bypassed` (surfaced from the GET response, not recomputed client-side). Submits `POST /api/v1/employees/{id}/offboarding/complete`. On success, navigate back to employee-detail showing the read-only state.

## 6. Employee-detail screen changes

- Enable the `offboarding-menu-item` button; on click, if no open offboarding record exists, navigate to Step 1; if one exists (`in_progress`/`initiated`), navigate to resume at its current step (from the `GET /api/v1/employees/{id}/offboarding` response).
- Once that GET reports `status='completed'` (or `Employee.EmploymentStatusId` is `resigned`/`terminated`), show a read-only banner and hide/disable the Promotion/Transfer/Offboarding menu entirely — mirrors the backend's 409 guard (which, per the backend spec §7, only actually fires on `change-position` — self-service edits are separately blocked because the offboarded employee can no longer authenticate at all) so the UI never round-trips a doomed request.

## 7. Approval Inbox

**No in-app `notifications` system exists in this codebase to ride** (verified against the backend — see backend spec §2/§3: `notifications`/`notification_channels`/`notification_templates` are documented in phase1-table-inventory but never built). The Approval Inbox is therefore a plain query screen: one "My Pending Approvals" list, calling `GET /api/v1/offboarding-bypass-requests?status=pending` (scoped server-side to the current user as approver), with Approve/Reject actions. No bell/badge/push element — the approver has to visit the page. Route/nav placement (a new top-level route vs. a panel reachable from the existing `people/approvals` route, which today handles a different Roles-permission-gated approval surface — see §2/route research) is an implementation-plan decision.

## 8. Testing

Component tests for the three new `checklist-builder` controls (conditional visibility on `templateType`), the wizard's step-gating logic (Step 6 disabled until required tasks are done), and the read-only banner condition. E2E/manual: full Start→Complete happy path against a running backend, cancel-and-restart, bypass request → approve → task shows `bypassed`, reject → task returns to `pending`.
