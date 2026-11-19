# Draft Chips Bar + Unsaved Changes Guard (Sub-project D) — Design

**Date:** 2026-09-29
**Status:** Approved in conversation (user: "go with your recommendations")
**Repos:** HRMS-Backend-v1 + Hrms--Web-application---front-end---v1, branch `feature/task-subtasks`
**Depends on:** A (bulk bar reads `--bottom-tray-offset`), B (employee list), C.

## Decisions
1. **Partial onboarding drafts: YES.** Saving a draft requires only company (legal entity) and last-saved step; every other field is optional at save time and validated only if present. Finalize keeps (and becomes the only place for) the full required-field validation.
2. **Drafts bar shows only the caller's own drafts** (task drafts + onboarding drafts they started). The "Onboarding Drafts" tab on the employee list is **removed** (its all-tenant overview for `employees:write` holders goes away).
3. Onboarding drafts in `waiting_for_seat` / `waiting_for_position_approval` **appear** as chips with a status badge. Finalized, cancelled and invitation-sent drafts never appear.
4. The component is named **drafts bar** (`app-drafts-bar`), never "tray" (that word already means the desktop tray app).

## Current state (verified)
- Task create modal and add-employee wizard both close (✕ / Escape / backdrop / Cancel) with no dirty check; the task modal deletes pending attachment uploads on close.
- Onboarding draft save = explicit button only; frontend requires all 9 fields, backend validator requires names, email, legal entity, employment type, start date, employee number. No delete endpoint; `cancelled` status exists but is never set. List endpoint: `employees:write` holders see all tenant drafts, others their own.
- No task drafts. No CanDeactivate guards, no `beforeunload`. Only precedent: calendar-event-form-modal `isDirty()` + "Discard changes?" confirm.
- `app-modal` only emits `closed`; the host owns `open`, so a host can veto closing.

## Unsaved Changes Guard (frontend, shared)
- `UnsavedChangesService` (root): forms register a `DirtyFormHandle { isDirty(): boolean; canSaveDraft(): boolean; saveDraft(): Promise<boolean>; discard(): void }` while open, unregister on close/destroy.
- `<app-unsaved-changes-dialog>`: title "Save draft?" (or "Discard changes?" when the form can't save a draft), buttons **Discard** (danger) · **Keep editing** · **Save draft**. Emits `discard | keep | save`.
- Close attempts in both forms go through `attemptClose()`: not dirty → close; dirty → dialog. Save → `saveDraft()`; on success close + refresh drafts bar; on failure stay open and show the error.
- `unsavedChangesGuard` (functional `CanDeactivateFn`, registered on the employees list route and the project-detail parent route): if the service has a dirty handle, open the dialog through the service and resolve the navigation by the user's choice.
- `beforeunload` listener (in the service) calls `preventDefault()` when any handle is dirty.
- Calendar event modal migrates to the shared dialog (Discard / Keep editing only — no draft support).

## Task drafts (backend)
- Table `task_drafts` (tenant-scoped, RLS, soft delete via `BaseEntity`): `id, tenant_id, owner_user_id, project_id, title (varchar 500, may be empty), payload_json (jsonb), created_at, updated_at, is_deleted, deleted_at`.
- `payload_json` is opaque to the backend (frontend form snapshot: description HTML, objectiveId, sprintId, categoryId, statusId, priority, dueDate, estimatedHours, storyPoints, assigneeEmployeeId, subtasks[], attachmentFileIds[]); max 256 KB.
- Endpoints under `api/v1/work` (same module gate as TasksController): `GET task-drafts` (mine, newest first), `GET task-drafts/{id}`, `POST task-drafts`, `PUT task-drafts/{id}`, `DELETE task-drafts/{id}`. Only the owner can read/update/delete (others get 404). Delete also deletes the payload's pending attachment files (best-effort, via the existing pending-upload delete command).
- The frontend deletes the draft after a successful create (no backend coupling to CreateTask).

## Onboarding drafts (backend)
- Relax `SaveOnboardingDraftCommandValidator` + write service: required = `LegalEntityId`, `LastSavedStep`; names/email/employee number/start date/employment type optional; format/uniqueness/FK checks run only when the value is present. Migration makes the affected columns nullable if they are not already.
- `DELETE api/v1/onboarding/drafts/{id}` (`employees:write`, starter-or-write rule same as GET) → status `cancelled`; 409 if finalized.
- List gets `mine=true` (forces `StartedById = caller`) and excludes `cancelled`/`finalized` when `mine=true`.

## Drafts bar (frontend)
- `DraftsStore` (root) loads both lists (`GET work/task-drafts`, `GET onboarding/drafts?mine=true`) into one `DraftChip[]` `{ kind: 'task' | 'employee', id, label, badge?, projectId? }`; refreshes on login, on save/delete, and on window focus.
- `<app-drafts-bar>` in main-layout after `<main>`: fixed bottom-left, hidden when empty, one chip per draft (icon + label, ellipsis at 24ch, badge for waiting states), ✕ with confirm. Sets `--bottom-tray-offset` on `document.documentElement` to its height while visible (0 when hidden). Horizontal scroll when many; at ≤768px sits above the mobile bottom nav.
- Chip click: task → `/work/{projectId}/backlog?taskDraftId={id}` (backlog opens the create modal hydrated from the draft); employee → `/people/employees?draftId={id}` (existing wizard resume).
- Task modal: input `draftId`; when set in create mode, load and apply the payload after `loadCreateContext`; "Save draft" = POST or PUT; successful create deletes the draft.
- Add-employee wizard: "Save draft" button and dialog save both use the relaxed rule (frontend requires only company); finalize keeps full validation.

## Testing
- Backend unit: task-draft handlers (owner-only, size cap, delete removes attachments best-effort), onboarding relaxed save (partial ok; checks only when present), delete → cancelled (+409 finalized), list mine filter; controller routing. Integration: migration + RLS on `task_drafts`; partial onboarding draft round-trip on Postgres.
- Frontend Vitest: service register/unregister + beforeunload; dialog; guard allow/deny/save paths; drafts store merge; drafts bar render/hidden/offset/delete/navigation; task modal save-draft/hydrate/delete-after-create; wizard partial save + dialog; employee list without the drafts tab.
