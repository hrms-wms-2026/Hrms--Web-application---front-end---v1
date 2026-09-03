# Part 7: Wire Delete Task and sprint-optional Create Task

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (rewritten 2026-08-21).

**Scope guard:** Work Management module only (`src/app/modules/work/**`).

**Hard dependency — do not start until both have shipped and are verified green:**
- Backend `part-4-delete-task-soft-delete.md` (new `DELETE /work/tasks/{id}` endpoint)
- Backend `part-5-sprint-optional-task-creation.md` (`CreateTaskCommand`/`CreateTaskCreationRequestCommand`
  now accept `sprintId: null`)

**Status:** shipped 2026-08-21 (Part 7 Tasks 1-4). Delete Task is confirmed then wired to `DELETE /work/tasks/{id}`; Module-row create omits Sprint (`sprintId: null`). Plan folder stays in `plans/next/` until a manual browser pass.

## Goal

Two backend-dependent gaps deliberately left stubbed in earlier frontend parts:
1. `TaskTreeRowComponent`'s and `TreeExplanationPanelComponent`'s Delete-task button (Part 5/6) currently
   emits `deleteRequested` into a no-op handler. Wire it to a real, confirmed deletion.
2. `ModuleTreeRowComponent`'s "Add task" icon (Part 5) currently opens the existing task-create modal, which
   today always requires picking a Sprint. Make the Sprint field optional when the create flow was entered
   from a Module row (not a Sprint row).

## Files to modify

- `src/app/modules/work/data-access/task-api.service.ts` — add `deleteTask(taskId: string):
  Observable<void>` → `DELETE /work/tasks/${taskId}`.
- `src/app/modules/work/state/project-detail.store.ts` — add `deleteTask(taskId: string)`: calls
  `taskApi.deleteTask`, then removes the node from `selectedSubtree` (find the parent Sprint-or-Module node
  containing it and filter it out of `children`, via the existing `updateTreeNode`/tree-walk helpers — don't
  just refetch the whole project tree after every delete, that's a much heavier round-trip than a local
  removal for a single-node change).
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` (+ `.html`, `.spec.ts`)
  — replace the Part 5 stub `onDeleteRequested` with: open a confirmation dialog (check what confirmation
  pattern this codebase already uses for destructive actions — e.g. `ProjectExplanationCardComponent`'s
  "Archive project" button likely already confirms via some shared modal/dialog; reuse that pattern, don't
  introduce a new one), then call `store.deleteTask(node.id)` on confirm.
- `src/app/modules/work/models/dto/task.dto.ts` (or wherever `CreateTaskRequestDto`/similar lives) —
  `sprintId: string` → `sprintId: string | null`.
- `src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts` (find its actual path/name —
  it's referenced from `MilestoneTreeTabComponent`'s existing create-task handler) — needs to accept being
  opened with no pre-selected Sprint (from a Module row's "Add task" icon) as well as its existing
  pre-selected-Sprint mode (from a Sprint row's icon). When opened Sprint-less, the Sprint field in the form
  should be optional (either omit it entirely for this entry mode, or show it as an optional dropdown — pick
  whichever fits the existing form's structure with the smaller diff, check the form before deciding).

## Tasks (small, do in order, one commit per task)

1. `taskApi.deleteTask` + service spec test.
2. `ProjectDetailStore.deleteTask` + local-removal tree update + store spec tests: (a) deletes the node and
   it's gone from `children` on the next read of `selectedSubtree`; (b) a failed HTTP call leaves the tree
   unchanged and surfaces an error (check how other store methods in this file report errors — e.g.
   `milestoneActionError`-style pattern — and match it, don't invent a new error-signal shape).
3. `MilestoneTreeTabComponent.onDeleteRequested` wired to confirm-then-delete, spec coverage: confirming
   calls `store.deleteTask`, cancelling does not.
4. Sprint-optional task creation: DTO change, modal changes, `onCreateTaskRequested`'s handling of a
   Module-row-originated create (no sprint) vs a Sprint-row-originated one (pre-filled sprint) — spec
   coverage for both entry paths.

## Definition of done

- All 4 tasks committed individually.
- `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` fully green.
- Manual check (dev server): delete a task from a tree row, confirm it disappears without a full page/tree
  reload; create a task directly from a Module's "Add task" icon with no sprint selected, confirm it appears
  in the tree as a direct child task under that module (not nested under a phantom sprint).
- Once this ships and gets a full manual browser pass (per this session's established rule — green tests
  alone aren't suffient, see the Project Page Redesign precedent), the whole
  `2026-08-20-work-management-tree-sprint-task-unified-view/` folder (both repos) can move to `finished/`.
