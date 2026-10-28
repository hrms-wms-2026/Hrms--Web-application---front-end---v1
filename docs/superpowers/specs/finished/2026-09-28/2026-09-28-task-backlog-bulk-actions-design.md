# Task Backlog Bulk Actions (Sub-project C) — Design

**Date:** 2026-09-28
**Status:** Approved in conversation (user added Convert to subtask + Due date; ⚑ defaults accepted: non-owner priority = skipped, delete of a task with subtasks = skipped)
**Repos:** HRMS-Backend-v1 + Hrms--Web-application---front-end---v1, branch `feature/task-subtasks`
**Depends on:** A (bulk bar, SelectionModel, dropdown menu), B (BulkEmployeeActionRunner, result modal)

## Current state (verified)
- Only the unsorted "Backlog" table is selectable; `app-sprint-tab` renders `app-task-table` without selection.
- Row checkbox gate: `objectiveOwners` = `milestone.isOwner`, which is **effective manager** (owner OR active member). `isEffectiveOwner` = owner of the module or an ancestor.
- Bulk "Move to sprint" = one full-overwrite `PATCH tasks/{id}` per task; Undo re-sends `sprintId: null` for tasks that came from the backlog, which the backend ignores → **undo silently fails** (bug).
- Backend per-task rules (all inside handlers, no endpoint permission attributes):
  - `MoveTaskStatusCommand` — effective manager; plain members cannot move into a Private status; achieved-sprint tasks rejected.
  - `AssignTaskCommand` — effective manager; 409 if already assigned (multiple assignees per task).
  - `DeleteTaskCommand` — effective manager; soft delete; **subtasks are orphaned** (bug).
  - `EditTaskCommand` — effective owner; full overwrite; re-runs event-window + allocation-slack checks.
  - `ConvertTaskToSubtaskCommand(TaskId, NewParentTaskId)` — effective manager of the target's module; one nesting level; same project; clears SprintId; reparents the task's own children.
  - `PUT sprints/{id}/tasks { addTaskIds, removeTaskIds }` — all-or-nothing, effective owner per task, Draft/Active sprint, writes sprint activity logs; the only way back to the backlog.

## Actions

| Action | Bar placement | Frontend gate | Backend |
|---|---|---|---|
| Status | primary | row selectable (member) | `POST work/tasks/bulk/status { taskIds, newStatusId }` → `MoveTaskStatusCommand` per task |
| Assign | primary | member | `POST work/tasks/bulk/assign { taskIds, employeeId }` → `AssignTaskCommand`; "already assigned" → skipped |
| Priority | primary | all selected modules `isEffectiveOwner`, else disabled w/ reason | `POST work/tasks/bulk/priority { taskIds, priority }` → new `SetTaskAttributesCommand` |
| Due date | more | same as Priority | `POST work/tasks/bulk/due-date { taskIds, dueDate \| null }` → `SetTaskAttributesCommand` |
| Move to sprint | more | same as Priority | existing `PUT sprints/{target}/tasks { addTaskIds }` |
| Move to backlog | more | same as Priority; hidden when no selected task is in a sprint | existing `PUT sprints/{id}/tasks { removeTaskIds }` per source sprint |
| Convert to subtask | more | member | `POST work/tasks/bulk/convert-to-subtask { taskIds, newParentTaskId }` → `ConvertTaskToSubtaskCommand` |
| Delete | more, danger, confirm dialog | member | `POST work/tasks/bulk/delete { taskIds }` → `DeleteTaskCommand` |

- New bulk endpoints: max 100 distinct ids, sequential, per-item result `{ items: [{ taskId, outcome: succeeded|failed, reason? }], succeeded, failed }`, change tracker cleared after every item, thrown validation errors become the item's reason.
- Non-owners are **not** turned into edit requests in bulk; they are reported as skipped by the backend's own 403 message.
- Undo (move to sprint / move to backlog) is rebuilt on `PUT sprints/{id}/tasks`, fixing the undo bug.

## Backend changes
1. **Generic runner:** extract the employee loop into `ONEVO.Application.Common.Services.BulkItemRunner` (id-agnostic). `BulkEmployeeActionRunner` delegates to it; its public API and wire format are unchanged.
2. **`TaskDueDateEventWindowRule`** (pure static): the event-window check moved out of `EditTaskCommandHandler` so edit and bulk share one rule.
3. **`SetTaskAttributesCommand(TaskId, Priority?, SetDueDate, DueDate?)`**: effective owner; achieved-sprint rejection; event-window rule when the due date changes; validates priority against `WorkTaskPriorities`; writes a `TaskEditLog` (Source Direct) with only the changed fields; no attachment/title/estimate side-effects.
4. **Delete guard:** `DeleteTaskCommandHandler` returns 409 `This task has subtasks. Delete or move its subtasks first.` when it has live children (single and bulk).
5. Six bulk commands + validators + `TasksController` endpoints under `tasks/bulk/*`.

## Frontend changes
1. Selection spans sprint sections and the Backlog table (`app-sprint-tab` passes `selectable`/`selectedIds` through and re-emits selection events). Selection clears on filter change (unchanged).
2. `<app-bulk-task-picker-dialog>`: one dialog, modes `status | priority | assignee | dueDate | parent`. Status lists only non-private statuses unless every selected task's module is `isEffectiveOwner`. Parent lists top-level tasks of the project not in the selection.
3. Delete uses `app-confirm-modal` ("Delete N tasks?").
4. The result modal moves to `shared/ui/bulk-action-result-modal/` with a neutral `BulkResultSummary { items: { id, outcome, reason }[], succeeded, pendingApproval, failed }`; employee list maps its response to it.
5. Move to sprint / backlog + undo use `SprintApiService.setTasks`.

## Testing
- Backend unit: BulkItemRunner; event-window rule; SetTaskAttributes (owner gate, achieved sprint, invalid priority, window conflict, edit log only changed fields); delete guard; each bulk command's dispatch + outcome mapping + validators; controller routing.
- Frontend Vitest: sprint-tab selection passthrough; backlog action gating (owner-only disabled with reason); picker dialog per mode; move/backlog/undo via setTasks (incl. undo-to-backlog); delete confirm; result modal adapter; employee list still green.
