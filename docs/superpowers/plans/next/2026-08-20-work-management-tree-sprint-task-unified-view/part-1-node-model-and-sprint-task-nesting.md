# Part 1: Tree node model + lazy Sprint/Task nesting

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (full frontend design + why). This part is purely additive — it does not remove or change any
existing UI yet, so it's safe to ship on its own if needed, but Part 2 and Part 3 build directly on it.

**Scope guard:** Work Management module only (`src/app/modules/work/**`). Do not touch other modules.

**Depends on (already shipped backend):** `GET /work/objectives/{id}/sprints`, `GET
/work/objectives/{id}/tasks` (both now reachability-checked), and the new `GET /work/sprints/{id}/tasks`.

**Status:** shipped 2026-08-21 (commits `905a9bb`..`37aa35e`) — `MilestoneTreeNode`'s `kind`
discriminator, `sprintTaskLoadState`, `updateTreeNode`, and `ProjectDetailStore.loadSprintsAndTasksForLeaf`/
`loadTasksForSprint` all exist in the working tree matching this part's design. Superseded in one respect:
`part-4-project-wide-tree-data-source.md` replaces `loadMilestoneSubtree`'s single-node
`GET /work/objectives/{id}/tree` call with the project-wide tree endpoint — the node model and lazy-fetch
methods this part built stay in place and get built on, not redone.

## Goal

Extend the tree's node model and the recursive tree-node component so a **leaf Objective** (no child
Objectives) can lazily reveal its Sprints + direct Tasks on first expand, and a **Sprint** node can lazily
reveal its Tasks on first expand — reusing the existing chevron/expand mechanism, not building a new one.

## Files to modify

- `src/app/modules/work/models/milestone.model.ts` — extend `MilestoneTreeNode`.
- `src/app/modules/work/utils/project.mapper.ts` — set `kind` explicitly in tree mappers, add
  `isLeafObjective` helper and an immutable `updateTreeNode` helper.
- `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` — new
  `expandLeafRequested` output, re-emitted at every recursion level, emitted from `toggleExpanded()`.
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`/`.html` — bind the
  new output to a store call.
- `src/app/modules/work/state/project-detail.store.ts` — new `loadSprintsAndTasksForLeaf`/
  `loadTasksForSprint` methods.
- `src/app/modules/work/data-access/task-api.service.ts` — add `getBySprintId(sprintId)`.
- `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts` — extend: the new
  output emits correctly, re-emits through nested recursion.
- `src/app/modules/work/state/project-detail.store.spec.ts` — extend: the two new store methods, plus a
  test for `updateTreeNode`/`isLeafObjective` if those land in a separate `project.mapper.spec.ts`.

## Before writing code

Read `milestone-tree-node.component.ts` and `milestone-tree-tab.component.ts` in full (both fully quoted
in the spec doc's §4 investigation, but confirm against the live file — this session's earlier lesson,
per `feedback_hrms_docs_lag_git`-adjacent practice: plans go stale fast in this codebase, verify before
trusting). Read `sprint-api.service.ts` (`getByObjective`) and `task-api.service.ts` (`getTasks`) for the
exact call signatures this part's new fetch logic must match.

## Tasks (small, do in order, one commit per task)

1. **Extend `MilestoneTreeNode`** (`milestone.model.ts`): add `kind: 'objective' | 'sprint' | 'task'`
   (default `'objective'` — update `toMilestoneTreeNode`/`toSubtreeNode` mapper in `utils/project.mapper.ts`
   to set it explicitly), and `sprintTaskLoadState?: 'unloaded' | 'loading' | 'loaded' | 'error'` (only
   meaningful on `kind: 'objective'` nodes that are leaves, and `kind: 'sprint'` nodes). Add a small helper
   `isLeafObjective(node: MilestoneTreeNode): boolean` (real `children.length === 0 && kind === 'objective'`)
   — export it from `project.mapper.ts` alongside the existing `findTreeNode`.
   - Test: mapper test — a subtree response maps every node to `kind: 'objective'`.

2. **`TaskApiService.getBySprintId`**: `getBySprintId(sprintId: string): Observable<WorkTaskDto[]> {
   return this.http.get<WorkTaskDto[]>(\`${this.baseUrl}/sprints/${sprintId}/tasks\`); }` — mirrors
   `getTasks` exactly, just a different route.
   - Test: extend `task-api.service.spec.ts` with a case asserting the GET call hits
     `/work/sprints/{id}/tasks`.

3. **Lazy-fetch on first expand — leaf Objective, dumb-component-stays-dumb**: `MilestoneTreeNodeComponent`
   today has no injected services (`node`/`selectedId`/`expandedByDefault`/`depth` inputs,
   `selected`/`createRequested` outputs only) — keep it that way. Add a new output
   `expandLeafRequested = output<MilestoneTreeNode>()`. In `toggleExpanded()`, flip `expanded` as today,
   and additionally — if `isLeafObjective(this.node())` (or `this.node().kind === 'sprint'`) and
   `sprintTaskLoadState` is `undefined`/`'unloaded'` — emit `expandLeafRequested.emit(this.node())`. Since
   this component recurses into itself for children, this output must be **re-emitted at every recursion
   level** exactly like `createRequested` already is (`(createRequested)="createRequested.emit($event)"`
   in the child `app-milestone-tree-node` binding) — add the identical re-emit wiring for the new output.
   - `MilestoneTreeTabComponent` (already injects `store`) handles the actual fetch: on
     `expandLeafRequested`, call a new `ProjectDetailStore` method — see Task 3b below — that fetches
     Sprints/Tasks/Statuses (leaf Objective) or Tasks (Sprint node) and returns an **updated, immutable**
     tree (new object references down the changed path, matching whatever `loadMilestoneSubtree` already
     does when it calls `patchState`). The tab component doesn't mutate `node()` in place; the new tree
     flows back down through the existing `[node]="tree"` binding on `app-milestone-tree-node`.

4. **`ProjectDetailStore` — new method** `loadSprintsAndTasksForLeaf(objectiveId: string)` (leaf
   Objective case) and `loadTasksForSprint(sprintId: string)` (Sprint case). Both: fetch the relevant
   API(s) (leaf case: `SprintApiService.getByObjective(objectiveId, false)` — not `activeOnly`, this view
   should show all sprints, not just active ones, since it replaces the old side panel which had no such
   filter — plus `TaskApiService.getTasks(objectiveId)` filtered client-side to `sprintId === null`, plus
   `TaskApiService.getStatuses(objectiveId)` for status-name resolution; sprint case: just
   `TaskApiService.getBySprintId(sprintId)`, reusing statuses already fetched for that sprint's parent
   leaf — pass them in as a param, don't re-fetch), map results into `kind: 'sprint'`/`'task'`
   pseudo-nodes, then `patchState` a new `selectedSubtree` with the target node's `children` replaced
   (write a small immutable tree-update helper, e.g. `updateTreeNode(tree, targetId, updater)`, in
   `project.mapper.ts` alongside `findTreeNode` — a recursive map that rebuilds the path from root to the
   target node with new object references, leaving untouched siblings/branches as the same references).
   On failure, patch `sprintTaskLoadState: 'error'` on that node instead. Mark `'loaded'` on success.
   - Sprint pseudo-node fields: `id: sprint.id, kind: 'sprint', title: sprint.name, description: null,
     startDate: sprint.startDate, endDate: sprint.endDate, progress: 0 (or omit/hide progress cell for
     sprint rows — see Part 3 for row rendering), allocatedHours: 0, completedHours: 0, isActive: true,
     isAchieved: sprint.status === 'achieved', ownerName: null, isOwner: <inherit from parent leaf
     Objective's isOwner>, children: [], sprintTaskLoadState: 'unloaded'`. Carry `sprint.status` too (add
     an optional `status?: string` field to `MilestoneTreeNode` for this) since Sprint rows need to show
     their lifecycle status per the user's "task status ellam view panna mudium" requirement extended to
     sprints.
   - Task pseudo-node fields: `id: task.id, kind: 'task', title: task.title, ..., status: <resolve status
     name — see Task 4>, isOwner: <inherit from parent>, children: []` (tasks are always leaves, no further
     expansion).
   - Tests: expanding a leaf Objective for the first time calls both APIs exactly once; expanding it a
     **second** time does NOT re-call them (state is `'loaded'`, cached); a non-leaf Objective's expand
     never calls either API (existing behavior, unchanged — regression-guard this explicitly since it's
     the one thing most likely to break silently); API failure sets `'error'` state and the row shows a
     retry affordance, clicking retry re-attempts the fetch.

5. **Lazy-fetch on first expand — Sprint node**: same pattern as Task 4, but `kind === 'sprint'` triggers
   `TaskApiService.getBySprintId(node.id)` only (no second call needed — a Sprint's tasks are already
   fully scoped server-side), mapped to `kind: 'task'` children.
   - Tests: mirror Task 4's cache/no-recall/error-retry cases for the Sprint-expand path.

6. **Task status name resolution**: Task rows need a human-readable status (per objective, `TaskStatusDto`
   lookup via `TaskApiService.getStatuses(objectiveId)` — the same per-objective status list the Board tab
   already loads). Fetch this once per leaf Objective (alongside Task 4's sprint/task fetch, not per-task)
   and resolve each task pseudo-node's `status` field from the `statusId → name` map, mirroring
   `TaskBacklogComponent`'s existing `statusNames()` pattern (`Object.fromEntries(statuses().map(s =>
   [s.id, s.name]))`) — don't invent a different resolution approach.
   - Test: a task pseudo-node's `status` field shows the resolved name, not the raw `statusId` guid.

## Data flow

Objective tree loads eagerly as today (`GetObjectiveSubtreeQuery`, unchanged). Expanding a **leaf**
Objective row for the first time triggers 3 parallel calls (Sprints, Tasks, Task Statuses for that
objective) → results merged into `sprint`/`task` pseudo-children → cached (`sprintTaskLoadState`) so
re-expanding doesn't re-fetch. Expanding a **Sprint** row for the first time triggers 1 call
(`GetSprintTasksQuery`, using the Task Statuses already fetched by its parent leaf Objective's Task 3 call
— pass them down, don't re-fetch per sprint) → cached the same way.

## Non-functional

Follow the existing `ProjectDetailStore` state-update convention exactly (check whether it uses
`patchState` with a fresh tree object or mutates in place — the store's other methods, e.g.
`loadMilestoneSubtree`, show the pattern). Don't introduce a second, inconsistent state-management
approach just for this feature.

## Definition of done

- All 6 tasks committed individually.
- Full frontend `work` module test suite green (`npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'`).
- No visible UI change yet from Part 1 alone (this part is data-layer + lazy-fetch plumbing; Part 2 wires
  the actual row rendering and icons). If you find the chevron already visually reveals sprint/task rows
  because `milestone-tree-node.component.ts`'s existing template already handles `children.length > 0`
  generically, that's fine and expected — just confirm rows render with sane (if unstyled/icon-less)
  content, full styling is Part 2's job.
