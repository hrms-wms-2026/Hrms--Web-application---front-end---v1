# Part 5: Split the tree row into 3 components with the full 6/4/2 icon sets

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (rewritten 2026-08-21).

**Scope guard:** Work Management module only (`src/app/modules/work/**`).

**Depends on:** `part-4-project-wide-tree-data-source.md` for the real per-node `isOwner` flag (icon
gating in this part is meaningless without it — an ancestor-context node must render icon-less).

**Builds on, does not redo:** the currently-shipped `MilestoneTreeNodeComponent`'s bubbling-output pattern
(`selected`, `createRequested`, `expandLeafRequested`, `createSprintRequested`, `createTaskRequested`,
`editRequested`, `membersRequested`) and its lazy-expand wiring (`showChevron`/`canLazyExpand`,
`onRetryLoad`) — this part restructures WHERE that logic lives (3 components instead of 1), not how the
bubbling/recursion/lazy-load mechanics work.

**Status:** not started

## Current state (verified by reading the live component, not the old plan)

`MilestoneTreeNodeComponent` (`src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`)
is a single recursive component rendering all 3 `kind`s inline, one 5-column grid row
(`grid-cols-[1fr_112px_40px_88px_72px]`: title/progress/owner-avatar/due-date/actions), with a single
kind-dependent plus-button (`plusAction()`) plus a members button (objective-only) and an edit button
(ungated for tasks, owner-gated otherwise). `isOwner` today is a flat boolean copied onto sprint/task
pseudo-nodes from their parent objective at construction time (`project.mapper.ts`); Part 4 makes this the
real per-node value from the backend for objective nodes (sprint/task nodes still correctly inherit it from
their parent objective — see Part 4's mapper notes, that inheritance is intentional, not a bug).

No "Achieve sub module" icon exists. No sprint completion bar (distinct from the shared progress bar), no
sprint status badge, no "Achieve Sprint"/"Complete Sprint" icons exist — though `SprintApiService.achieve(id)`
and `.complete(id)` already exist at the data-access layer, just not called from anywhere. No task assignee
display exists on task rows. No delete icon exists on task rows (this part renders it and wires its output;
the actual delete call is `part-7-delete-task-and-sprint-optional-create.md`, gated on backend Part 4
shipping — do not wire a real API call to it here, see task 3's note).

## Target shape

Three new presentational components, each responsible for exactly one `kind`'s row rendering and icon set.
`MilestoneTreeNodeComponent` becomes a thin recursive shell: it picks which of the 3 to render based on
`node().kind`, still owns the recursion into `children`, and still re-emits every child output upward
(same bubbling pattern as today — don't change that mechanism, just delegate the row's *visual content* to
the new components).

### `ModuleTreeRowComponent` (`src/app/modules/work/ui/module-tree-row/`)

Renders an `objective`-kind node's row. 6 icons, all hover-revealed (match the existing
`row-actions` hover-reveal CSS pattern), all hidden entirely when `!node().isOwner` (per the confirmed
requirement: ancestor-context-only modules are view-only, zero icons — this is a harder gate than today's
per-icon `isOwner` checks, apply it once at the row level, not per-icon):
1. Create sub module → re-emits existing `createRequested` (unchanged wiring, `MilestoneCreateSubModuleModalComponent`
   or whatever the current modal is — check `MilestoneTreeTabComponent`'s `onCreateSubRequested` handler for
   the exact modal component name).
2. Edit module → re-emits existing `editRequested`.
3. Member management → re-emits existing `membersRequested`.
4. Add task → **new** output `createTaskRequested` emitted directly from a Module row (today this output
   only exists on Sprint rows) — carries the node so the handler knows to call `CreateTaskCommand` with
   `sprintId: null` (depends on backend Part 5 shipping before this is meaningful; the icon and event can
   ship now, wire the actual sprint-less creation once backend Part 5 lands — same "build the plumbing, gate
   the last mile" approach as the delete-task icon below).
5. Add Sprint → re-emits existing `createSprintRequested` (today only shown for *leaf* objectives via
   `isLeafObjective(n)`; keep that same leaf-only gate — a non-leaf module with sub-modules doesn't get
   sprints directly, matches current behavior, don't change this rule).
6. Achieve sub module → **new** output `achieveRequested`, wired at `MilestoneTreeTabComponent` to the
   already-existing `store.achieveMilestone(id)`/`store.unachieveMilestone(id)` (no backend gap — these
   commands already exist and are already used by the settings modal; this is purely a second UI entry
   point to the same store methods). Icon should reflect current state (show "Achieve" if
   `!node().isAchieved`, "Unachieve" if already achieved — mirror whatever toggle affordance the settings
   modal already uses for consistency, don't invent a new one).

### `SprintTreeRowComponent` (`src/app/modules/work/ui/sprint-tree-row/`)

Renders a `sprint`-kind node's row. Layout: sprint icon (new, simple SVG — calendar-with-checkmark or
similar, pick something visually distinct from the objective folder icon and task checkmark icon already in
`MilestoneTreeNodeComponent`) + name + status badge (`node().status`, already available) + a completion bar
chart (new — a simple horizontal `<div>` fill bar driven by `node().progress` or
`completedHours/allocatedHours`, check which one `MilestoneTreeNodeComponent`'s existing shared progress bar
uses today and reuse the same computation, don't introduce a second progress formula). 4 icons, same
row-level `isOwner` gate as Module rows:
1. Create task → re-emits existing `createTaskRequested` (unchanged, already sprint-scoped).
2. Edit Sprint → re-emits existing `editRequested` (confirm it already routes to the sprint edit form for
   `kind === 'sprint'` — per commit `b1c07b3` "open the matching edit modal from each tree-row kind", it
   should; verify by reading `MilestoneTreeTabComponent.onEditRequested` rather than assuming).
3. Achieve Sprint → **new** output `achieveSprintRequested`. Needs a **new** `ProjectDetailStore` method
   `achieveSprint(sprintId)` calling `SprintApiService.achieve(sprintId)` (data-access method already
   exists, just never called) then patching the affected node's state into `selectedSubtree` via the
   existing `updateTreeNode` helper (mirror how `loadTasksForSprint` already patches sprint nodes, for the
   immutable-update pattern).
4. Complete Sprint → **new** output `completeSprintRequested`, same shape as Achieve, calling
   `SprintApiService.complete(sprintId)` via a new `completeSprint(sprintId)` store method.

### `TaskTreeRowComponent` (`src/app/modules/work/ui/task-tree-row/`)

Renders a `task`-kind node's row. Layout: task name + assignee (new — read from `node().taskSource` per the
existing `WorkTask` type already threaded onto task pseudo-nodes, check `WorkTask`'s assignment shape; if
assignee isn't already present on the `WorkTaskResponse`/`WorkTask` model as returned by
`GetSprintTasksQuery`/`GetObjectiveTasksQuery`, this is a real gap — verify before assuming it's just a
template binding away) + task status badge (`node().status`, already available). 2 icons:
1. Edit task → re-emits existing `editRequested` (unchanged — task edit is already ungated,
   `showEdit()` today returns true unconditionally for `kind === 'task'`; **keep that**, don't add an
   `isOwner` gate to task-edit that doesn't exist today — the row-level `isOwner` gate that hides Module/
   Sprint icons should NOT apply to the Task row's Edit icon, only to Delete, per how editing already works
   today for tasks distinctly from objectives/sprints).
2. Delete task → **new** output `deleteRequested`, row-level `isOwner`-gated (unlike Edit). Emits the node;
   `MilestoneTreeTabComponent` should have a handler `onDeleteRequested` **stubbed to do nothing but log a
   TODO** in this part — do not call a `deleteTask` store method or any HTTP endpoint yet, that endpoint
   doesn't exist until backend Part 4 ships. Wiring the real call is `part-7-delete-task-and-sprint-optional-create.md`.
   Building the icon/output now, stubbed, means Part 7 is a small, isolated diff instead of another
   component restructure.

## Files to create

- `src/app/modules/work/ui/module-tree-row/module-tree-row.component.ts` (+ `.spec.ts`)
- `src/app/modules/work/ui/sprint-tree-row/sprint-tree-row.component.ts` (+ `.spec.ts`)
- `src/app/modules/work/ui/task-tree-row/task-tree-row.component.ts` (+ `.spec.ts`)

## Files to modify

- `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` (+ `.spec.ts`) — becomes
  the thin `@switch (node().kind)` shell described above; keep the recursion (`children.map(...)` into
  itself) and every existing output re-emission, add re-emission of the 4 new outputs
  (`achieveRequested`, `achieveSprintRequested`, `completeSprintRequested`, `deleteRequested`).
- `src/app/modules/work/state/project-detail.store.ts` — add `achieveSprint(sprintId)`,
  `completeSprint(sprintId)` methods (pattern-match `loadTasksForSprint`'s `updateTreeNode` usage for the
  immutable patch-back).
- `src/app/modules/work/data-access/sprint-api.service.spec.ts` — no change expected (methods already
  exist), but re-run to confirm nothing regresses.
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` (+ `.html`, `.spec.ts`)
  — add handlers for the 4 new outputs: `onAchieveRequested` (calls existing
  `achieveMilestone`/`unachieveMilestone`), `onAchieveSprintRequested`, `onCompleteSprintRequested` (call
  the 2 new store methods), `onDeleteRequested` (stub only, per above).

## Tasks (small, do in order, one commit per task)

1. `ModuleTreeRowComponent` — extract Module rendering + all 6 icons (5 rewired from existing outputs, 1
   new `achieveRequested`) out of `MilestoneTreeNodeComponent`, with its own spec covering: all 6 icons
   visible for an owned node, zero icons visible for `isOwner: false`, "Add Sprint" only on leaf modules.
2. `SprintTreeRowComponent` — extract Sprint rendering + completion bar + 4 icons, 2 new store methods
   (`achieveSprint`/`completeSprint`) + their store spec tests, component spec covering the same
   owned/not-owned icon-visibility split plus the new sprint icon and status badge.
3. `TaskTreeRowComponent` — extract Task rendering + assignee display + 2 icons (edit ungated, delete
   row-level-gated), component spec covering: edit always visible regardless of `isOwner`, delete only
   visible when `isOwner`, delete click emits `deleteRequested` with the correct node and (per the stub)
   causes no HTTP call yet.
4. Reduce `MilestoneTreeNodeComponent` to the thin switch-shell, re-run its existing spec file and fix any
   assertions that targeted markup now living in the 3 child components (expect a meaningful rewrite of
   this spec file, not just a trim — most of its current assertions about icon visibility move to the 3 new
   spec files).
5. `MilestoneTreeTabComponent` wiring for the 4 new outputs + spec updates.

## Definition of done

- All 5 tasks committed individually.
- `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` fully green.
- Manual check (dev server): confirm an ancestor-context module (visible in the tree, not owned by the
  logged-in caller) renders with genuinely zero icons, not just visually de-emphasized ones.
