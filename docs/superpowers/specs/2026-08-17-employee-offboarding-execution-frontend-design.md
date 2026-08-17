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
- **No onboarding wizard frontend exists yet** (checked — nothing under any `*onboard*` frontend directory) to mirror. The offboarding wizard is UX-greenfield on the frontend; only its checklist *template* editing reuses existing UI.
- **The checklist template management UI already exists and already distinguishes onboarding/offboarding**: `checklist-templates.component.ts` has an `activeTypeTab` signal (`'all'|'onboarding'|'offboarding'`) for the list view, and `checklist-builder.component.ts` already has a `templateType` form control (defaults `'onboarding'`, user-selectable) and a per-task `isRequired` checkbox in its `FormArray`. Per the user's explicit instruction, this design **extends `checklist-builder.component.ts`** with the offboarding-only bypass/penalty/category fields — it does not build a new template editor.
- **`checklist-template.model.ts`** already types `ChecklistTemplateType = 'onboarding' | 'offboarding'` and the task request/response DTOs — this design adds `isBypassable`, `bypassPenaltyDescription`, `category` to `ChecklistTemplateTaskRequest`/`Response` (all optional, matching the backend's optional/default-false fields).
- **`checklist-api.service.ts`** is the existing HTTP client for template CRUD — a new sibling service (or an extension, TBD at plan time) is needed for the employee-checklist-task and offboarding-record endpoints, since no frontend code touches `employee_checklist_tasks` today (confirmed no backend controller exists for it either — see backend spec §3).

## 3. Scope

**In scope:** the offboarding wizard (6 routed steps), enabling the employee-detail stub, extending `checklist-builder.component.ts`/`.html` with offboarding-only task fields, a small "My Approvals" surface for bypass decisions.

**Out of scope:** any onboarding-side frontend work (no onboarding wizard exists and none is built here), a new template-authoring shell (extends the existing one only), file upload on tasks, computed settlement amounts (backend spec §2 — Payroll is Phase 2).

## 4. Checklist builder extension

In `checklist-builder.component.ts`'s per-task `FormGroup` (alongside the existing `isRequired` control), add three controls — rendered only when `form.controls.templateType.value === 'offboarding'` (same conditional pattern already used for the position-vs-employee assignee fields at line ~287):

- `isBypassable: boolean` (checkbox, default `false`)
- `bypassPenaltyDescription: string | null` (text input, shown only when `isBypassable` is checked)
- `category: 'asset_return' | 'access_removal' | 'document_handover' | 'final_settlement' | 'knowledge_handover' | 'other' | null` (select)

Submitted as part of the existing `tasks` array payload to `POST/PUT /checklist-templates` — no new endpoint, just wider request/response DTOs (backend spec §4.2).

## 5. Offboarding wizard

Route: `/people/employees/:id/offboarding` (new feature module `src/app/modules/people/feature/offboarding/`, following this codebase's existing feature/data-access/state layering). A step indicator matches the image's 6 numbered steps; each step is its own routed child or a signal-driven step index within one shell component (decide at implementation-plan time based on how much per-step deep-linking/back-button behavior is wanted — both are consistent with this codebase's Angular 21 patterns).

1. **Start Offboarding** — form: last working day, exit reason (select: resignation/termination/retirement/contract_end), rehire eligibility (select), knowledge risk level (select), notes (textarea). Submits `POST .../offboarding`.
2. **Choose Exit Checklist** — radio list of matching active offboarding templates (name + match level, mirroring the onboarding draft wizard's template-matching UI pattern once that's built, or built fresh here since it doesn't exist yet either). Submits `POST .../offboarding/select-checklist`.
3. **Review Tasks** — editable list (owner, due date, required toggle) over the instantiated tasks. `PATCH` per edited task.
4. **Track Exit Work** — read-only progress view grouped by `category` (Assets Returned / Access Removed / Documents Handover / Final Settlement / Knowledge Handover / Other), overall percent bar, matching the image's "Progress Overview."
5. **Complete or Bypass Tasks** — per-task Complete button; Bypass button opens a small form (reason, penalty — prefilled from the task's `bypassPenaltyDescription`, editable, "None" allowed, approver picker scoped to users holding `employees:write`). Inline list of this offboarding's pending bypass requests.
6. **Complete Employee Exit** — summary/review, disabled until every required task is `completed`/`bypassed` (surfaced from the GET response, not recomputed client-side). Submits `POST .../offboarding/complete`. On success, navigate back to employee-detail showing the read-only state.

## 6. Employee-detail screen changes

- Enable the `offboarding-menu-item` button; on click, if no open offboarding record exists, navigate to Step 1; if one exists (`in_progress`/`initiated`), navigate to resume at its current step (from the `GET .../offboarding` response).
- Once `GET .../offboarding` reports `status='completed'` (or `Employee.EmploymentStatusId` is `resigned`/`terminated`), show a read-only banner and hide/disable the Promotion/Transfer/Offboarding menu entirely — mirrors the backend's 409 guard so the UI never round-trips a doomed request.

## 7. Approval Inbox

Per the backend design, bypass-request notifications ride the existing in-app `notifications` system (bell/inbox) — no new global inbox is built. This design adds one small "My Pending Approvals" list (calls `GET /api/v1/people/bypass-requests?status=pending`, scoped server-side to the current user as approver) as a lightweight surface for Approve/Reject, reachable from wherever this codebase's existing notifications bell/inbox links out to action-required items — exact integration point (a new route vs. a panel) is an implementation-plan decision, not a design fork.

## 8. Testing

Component tests for the three new `checklist-builder` controls (conditional visibility on `templateType`), the wizard's step-gating logic (Step 6 disabled until required tasks are done), and the read-only banner condition. E2E/manual: full Start→Complete happy path against a running backend, cancel-and-restart, bypass request → approve → task shows `bypassed`, reject → task returns to `pending`.
