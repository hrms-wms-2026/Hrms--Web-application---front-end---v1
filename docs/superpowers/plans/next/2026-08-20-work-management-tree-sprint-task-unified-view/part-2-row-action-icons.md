# Part 2: Per-row action icons (create/edit/members), wired to existing modals

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4. **Depends on Part 1** (needs `kind`, `isLeafObjective`, the lazy-load state, and the pseudo-node
shapes it introduces). This part is still additive — the old `app-milestone-detail-panel` side panel
stays in place and keeps working; Part 3 removes it once these row icons cover everything it did.

**Scope guard:** Work Management module only.

**Status:** shipped 2026-08-21 (commits `83b1864`..`52374b5`) — the single/plus create button, edit, and
members icons all exist in `MilestoneTreeNodeComponent` matching this part's design.
`part-5-module-sprint-task-row-components.md` supersedes this part's "one shared icon set on one recursive
component" shape: the expanded requirement needs 6 icons on Module rows / 4 on Sprint rows / 2 on Task rows
across 3 separate components — more than this part built. Treat this file as the historical base the new
icons get added on top of, not the current target shape.

## Goal

Add inline action icons directly on tree rows, per kind, confirmed:
- **Objective, non-leaf**: existing "+" (create sub-objective, unchanged) + new member icon + new edit
  icon (both owner-gated).
- **Objective, leaf**: "+" **becomes create-Sprint** instead of create-sub-objective (the flagged judgment
  call from the spec — confirm with the user if this looks wrong once they see it) + member icon + edit
  icon (both owner-gated, same as non-leaf).
- **Sprint row**: "+" (create Task, scoped to this sprint) + edit icon. No member icon.
- **Task row**: edit icon only, no owner gate.

## Files to modify

- `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` — replace the single
  "+"-only action slot with a per-`kind` icon group; new outputs (see Tasks below).
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`/`.html` — handle the
  new outputs, conditionally render the (already-existing) modals, refresh the affected node's
  sprint/task children on success (reuse Part 1's store methods, forcing a refetch — add a
  `force?: boolean` param to `loadSprintsAndTasksForLeaf`/`loadTasksForSprint` that bypasses the
  `'loaded'` cache check).
- `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts` — extend.
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts` — extend.

## Before writing code

**Verify, don't assume, how the reused modals get their data written back** — read
`sprint-create-form.component.ts`, `sprint-edit-form.component.ts`, `task-create-modal.component.ts`, and
`task-detail-modal.component.ts` **in full**. The spec's earlier investigation found
`SprintCreateFormComponent`/`SprintEditFormComponent` to be self-contained (they inject `SprintListStore`
themselves and call it internally, emitting `created`/`saved` only as a "done, close me and refresh"
signal) — confirm this is still true, and confirm whether `TaskCreateModalComponent`/
`TaskDetailModalComponent` follow the same self-contained pattern or instead emit a payload the *parent*
must send to an API (like `ProjectSettingsModalComponent` does). This changes how much wiring code
Task 3/4 below actually need — don't guess, read the real files first.

## Tasks (small, do in order, one commit per task)

1. **`MilestoneTreeNodeComponent` — new outputs**: `createSprintRequested`, `createTaskRequested`,
   `editRequested`, `membersRequested` — all `output<MilestoneTreeNode>()`, all re-emitted at every
   recursion level exactly like `createRequested`/the Part 1 `expandLeafRequested` output already are.
   Keep the existing `createRequested` (create-sub-objective) output as-is for non-leaf Objective rows.

2. **Row icon rendering per kind**: in the row template, branch on `node().kind` and (for objective)
   `isLeafObjective(node())`:
   - non-leaf Objective: existing "+" button unchanged (emits `createRequested`) + new member icon
     (`membersRequested`) + new edit icon (`editRequested`), both `@if (node().isOwner)`.
   - leaf Objective: "+" button now emits `createSprintRequested` instead of `createRequested`, same
     owner-gate and visual style as the existing button (don't invent new icon art, reuse the existing "+"
     SVG). Member icon + edit icon, same as non-leaf.
   - Sprint: "+" emits `createTaskRequested`, owner-gate on the **parent leaf Objective's** `isOwner`
     (Sprint pseudo-nodes carry `isOwner` inherited from Part 1's Task 4 mapping — use that field
     directly, don't re-derive it). Edit icon emits `editRequested`, same gate. No member icon.
   - Task: edit icon only (`editRequested`), no gate — always visible.
   - Also render `node().status` (Sprint/Task rows) somewhere in the row — reuse the existing "Achieved"
     badge's visual style/position for Sprint status, and add a small text/badge for Task status next to
     the title (check how `TaskTableComponent`/`TaskBoardStore`'s columns render status text today and
     match that convention rather than inventing new styling).
   - Tests: for each `kind`/leaf-vs-non-leaf combination, the right icon set renders and emits the right
     event on click; owner-gated icons are absent when `isOwner` is false.

3. **`MilestoneTreeTabComponent` — Sprint creation**: on `createSprintRequested`, open
   `app-sprint-create-form` (`[objectiveId]="node.id"` — the leaf Objective's id — `[isObjectiveOwner]`
   from the node). On its `created`/`cancelled` output (confirm exact output name from the file you read),
   close it and call `store.loadSprintsAndTasksForLeaf(node.id, { force: true })` to refresh that leaf's
   children with the new sprint included.
   - Test: creating a sprint from a leaf row's "+" refreshes that leaf's children.

4. **`MilestoneTreeTabComponent` — Task creation**: on `createTaskRequested`, open `app-task-create-modal`
   with `[objectiveId]` set to the **owning leaf Objective's id** (a Sprint node needs to carry its parent
   leaf's id — add this to the Sprint pseudo-node shape in Part 1 if it isn't already implicitly available
   via tree traversal; simplest is an extra field on the Sprint node rather than re-walking the tree) and
   `[activeSprints]="[thatSprint]"` (the single-element-array pattern already used elsewhere to
   auto-scope/hide the sprint picker). On success, refresh via `store.loadTasksForSprint(sprintId, {
   force: true })`.
   - Test: creating a task from a sprint row's "+" refreshes that sprint's children, and the modal opens
     pre-scoped to the one sprint (no sprint picker shown).

5. **`MilestoneTreeTabComponent` — Edit (all 3 kinds)**: on `editRequested`, branch on `node().kind`:
   Objective → open `app-milestone-settings-modal` exactly as the existing detail-panel wiring already
   does (`onEditRequested`/`onSettingsSaved` in the current file — reuse this logic, just trigger it from
   the new row event instead of/alongside the detail panel's button). Sprint → open
   `app-sprint-edit-form`. Task → open `app-task-detail-modal`. On success, refresh the relevant node's
   children (Objective edit doesn't need a sprint/task refresh; Sprint/Task edits do, via the Task 3/4
   refresh calls).
   - Tests: each kind opens the right modal with the right initial data.

6. **`MilestoneTreeTabComponent` — Members (Objective only)**: on `membersRequested`, reuse the existing
   `onMembersRequested`/`app-objective-members-popup` wiring unchanged, just triggered from the row icon
   instead of the detail panel.
   - No new test needed if this is a pure re-trigger of already-tested existing logic — confirm the
     existing members-popup tests still pass.

## Data flow

Row icon click → tab component opens the matching existing modal (unchanged modal internals) → on
success, tab component calls the Part 1 store method with `force: true` for the affected node → store
re-fetches and rebuilds that node's `children` via `updateTreeNode` → new tree flows down through
`[node]="tree"` → the row (and any already-expanded children) re-render with fresh data.

## Non-functional

No new modal components. No new icon SVGs beyond what's already in the tree-node template (reuse the
existing "+" glyph; for edit/member icons, check `app-milestone-detail-panel`'s existing edit/member
buttons for the SVG markup already used there and copy it rather than inventing new icon art — visual
consistency with the rest of this module matters more than pixel-perfect novelty here).

## Definition of done

- All 6 tasks committed individually.
- Full frontend `work` module test suite green.
- Manually confirm (via tests, not required to click through live) that the old
  `app-milestone-detail-panel` still works unchanged at this point — Part 2 is additive, don't touch its
  wiring except where Task 5 explicitly reuses its edit logic.
