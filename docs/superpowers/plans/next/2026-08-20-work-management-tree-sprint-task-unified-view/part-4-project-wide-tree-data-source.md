# Part 4: Switch the Tree tab to the project-wide tree endpoint

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (rewritten 2026-08-21).

**Scope guard:** Work Management module only (`src/app/modules/work/**`).

**Depends on backend Part 3** (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-20-work-management-tree-sprint-task-unified-view/part-3-enrich-objective-tree-response.md`)
— must ship first, this part consumes its new `Progress`/`OwnerName`/`IsOwner` fields.

**Builds on, does not redo:** `part-1-node-model-and-sprint-task-nesting.md` (shipped) — the
`MilestoneTreeNode` model, `kind` discriminator, `sprintTaskLoadState`, `updateTreeNode`, and
`loadSprintsAndTasksForLeaf`/`loadTasksForSprint` lazy-fetch methods all stay exactly as they are. Only the
**root-level fetch** (`loadMilestoneSubtree`, currently `GET /work/objectives/{id}/tree`) is being replaced.

**Status:** not started

## Why

Confirmed requirement: a member of a CHILD module must see the PARENT module's full tree context (so they
understand where their module sits), but must NOT see the parent's own Sprints/Tasks — only their own
scope's. The current single-node `GetObjectiveSubtreeQuery`-backed call (`GET
/work/objectives/{id}/tree`) can't express this: it's rooted at exactly one objective with no
ancestor-context concept. The already-existing `GetObjectiveTreeQuery`-backed endpoint (`GET
/api/v1/work/projects/{projectId}/objectives`) already implements the correct reachability rule server-side
(ancestor + owned + descendant walk) — the frontend just isn't calling it yet.

## Current state (verified by reading the live files, not the old plan)

- `ProjectApiService.getMilestoneSubtree(objectiveId)` → `GET /work/objectives/{objectiveId}/tree`, returns
  `ObjectiveSubtreeResponseDto { parentObjective, objective }`. `objective` (single node + its declared
  nested `children`, i.e. sub-modules only — NOT sprints/tasks, those are lazy-loaded separately) is mapped
  via `toMilestoneTreeNode` and stored in `ProjectDetailStore.selectedSubtree`. `parentObjective` is fetched
  but currently discarded — never patched into state.
- No project-wide tree endpoint or DTO exists anywhere in the frontend today. `grep -rn
  "GetObjectiveTreeQuery\|ObjectiveTreeResponseDto\|projects/.*objectives" src/app/modules/work` returns
  nothing.
- `MilestoneTreeTabComponent` renders one `<app-milestone-tree-node [node]="tree">` bound to
  `store.selectedSubtree()`.
- The Tree tab route is `/milestones/:milestoneId/tree` (one of the sub-menu tabs) — `:milestoneId` is
  which of the caller's *own* modules (from `loadMyMilestones`) is currently active.

## Design decision — confirmed with the user 2026-08-21

Fetch stays **project-scoped**: the Tree tab calls `getProjectTree(projectId)` once and gets the caller's
entire reachable tree, not just the active module's subtree. On top of that, add a **Module filter**
control at the top of the Tree tab (a dropdown, "All modules" + one entry per module the caller can see in
the fetched tree) that narrows what's *rendered* — purely client-side, no refetch, since the whole tree is
already in memory. **Default selection is the currently active module** (`:milestoneId` from the route) —
so on first load the Tree tab looks and feels like today's single-module view, and the user opts into
seeing more by changing the filter, rather than being shown the full tree unfiltered by default. Route
shape (`/milestones/:milestoneId/tree`) and the sub-menu stay unchanged; other tabs
(Board/Backlog/List/etc.) stay scoped to one objective via their existing per-objective endpoints — this
change is Tree-tab-only.

Filtering to one module means: render that module's node plus its full descendant subtree, plus its
ancestor chain above it rendered view-only (so "parent context" is still visible even when filtered) —
exactly the same per-node content as the unfiltered view, just pruned to one branch. "All modules" shows
everything the fetch returned, unpruned.

## Files to create

- `src/app/modules/work/models/dto/objective-tree.dto.ts` — `ObjectiveTreeItemDto` (mirrors
  `ObjectiveTreeItemViewModel`: `id, parentObjectiveId, isDefault, title, ownerId, startDate, endDate,
  allocatedHours, completedHours, isActive, isAchieved, progress, ownerName, isOwner` — the last 3 are new,
  confirm exact casing against the actual JSON once backend Part 3 has shipped, don't guess).

## Files to modify

- `src/app/modules/work/data-access/project-api.service.ts` — add
  `getProjectTree(projectId: string): Observable<ObjectiveTreeItemDto[]>` calling `GET
  /work/projects/${projectId}/objectives` (confirm base path prefix against `environment.apiUrl` — the
  backend route is `~/api/v1/work/projects/{projectId}/objectives`, an absolute override, so check whether
  `environment.apiUrl` already includes `/api/v1` the same way the existing `getMilestoneSubtree` call's
  base does, to avoid a doubled or missing path segment).
- `src/app/modules/work/models/milestone.model.ts` — no new fields needed on `MilestoneTreeNode` itself
  (it already has `isOwner`; Part 4 only changes how that field gets populated — from the new per-node
  `IsOwner` the backend now sends, instead of always `true`/inherited-from-parent as today).
- `src/app/modules/work/models/project.mapper.ts` — new function `buildObjectiveForest(items:
  ObjectiveTreeItemDto[]): MilestoneTreeNode | null` that:
  1. Indexes all items by `id`.
  2. Groups children by `parentObjectiveId`.
  3. Recursively builds a `MilestoneTreeNode` tree starting from the item(s) with `parentObjectiveId ===
     null` (there should be exactly one — the project's Default Objective — assert/log if there's more than
     one rather than silently picking the first, since that would indicate a real data problem worth
     surfacing).
  4. Sets `kind: 'objective'` and `isOwner: item.isOwner` (the real per-node flag now, not a placeholder) on
     every built node. Sprint/Task pseudo-nodes are still attached later, lazily, by the existing
     `loadSprintsAndTasksForLeaf`/`loadTasksForSprint` — those still copy `isOwner` from their parent
     Objective node, which is correct (Sprint/Task-level ownership is Objective-scoped, not independently
     tracked — matches backend confirmation that sprints/tasks have no membership concept of their own).
  5. Do not lose any existing field mapping `toMilestoneTreeNode` already does for `description`,
     `startDate`, `endDate`, `progress`, `allocatedHours`, `completedHours`, `isActive`, `isAchieved`,
     `ownerName` — `ObjectiveTreeItemDto` now carries all of these too (after backend Part 3), reuse the
     same per-field mapping logic, don't duplicate it as a second implementation; consider having
     `buildObjectiveForest` call a shared per-node mapper that both `toMilestoneTreeNode` (still used
     elsewhere? check) and this new function call, if one can be cleanly factored out without a larger
     refactor than this part's scope justifies — if not, a small amount of duplication here is acceptable,
     don't over-engineer.
- `src/app/modules/work/state/project-detail.store.ts`:
  - Replace `loadMilestoneSubtree(objectiveId)` with `loadProjectTree(projectId)`: calls
    `api.getProjectTree(projectId)`, builds the tree via `buildObjectiveForest`, patches into
    `selectedSubtree` (keep the state field name — every other method in this store already reads/writes
    `selectedSubtree`, and `loadSprintsAndTasksForLeaf`/`updateTreeNode`/etc. all operate on it structurally,
    not by name; renaming it is a larger, purely-cosmetic diff this part doesn't need to make).
  - Update `clearSelectedSubtree()` — no change needed, already generic.
  - Every other store method that walks `selectedSubtree` (`loadSprintsAndTasksForLeaf`,
    `loadTasksForSprint`, `getMilestoneDetail`, `editMilestone`, etc.) — read each one and confirm none of
    them assume the tree is single-node-rooted in a way that breaks now that the root can have real
    sibling-module subtrees hanging off shared ancestors (e.g. any code that assumes `tree.id === $
    {theRequestedObjectiveId}` at the top level must instead search the whole tree, which `updateTreeNode`
    /`findTreeNode` already do recursively — confirm this, don't assume).
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` (+ `.html`, `.spec.ts`)
  — call `store.loadProjectTree(this.projectId)` instead of `store.loadMilestoneSubtree(this.milestoneId)`
  on init (get `projectId` the same way `ProjectDetailComponent` does, via the parent route's `:id` param —
  check whether this component already has access to it or needs `ActivatedRoute` parent traversal added).
  Add a local `selectedModuleFilter` signal, initialized to `:milestoneId` from the route (`'all'` as the
  sentinel for "All modules"). Render the new filter dropdown above the tree. Compute the rendered tree via
  a `computed()` that prunes `store.selectedSubtree()` down to the filtered module's branch + ancestor
  chain when a specific module is selected, or passes the full tree through unchanged for `'all'` — a pure
  client-side filter over already-fetched data, no new HTTP call on filter change.

## Files to create (module filter)

- `src/app/modules/work/ui/module-filter-select/module-filter-select.component.ts` (+ `.spec.ts`) — a
  simple dropdown/select, `options = input.required<{id: string; title: string}[]>()`,
  `selected = input.required<string>()` (`'all'` or a module id), `selectionChanged =
  output<string>()`. Keep this presentational and reusable — no store/API injection, matches the
  "dumb component" convention already used elsewhere in this module.
- `src/app/modules/work/models/project.mapper.ts` — new function `pruneTreeToModule(tree:
  MilestoneTreeNode, moduleId: string): MilestoneTreeNode | null` that finds the target module node and
  returns a new tree containing only: the path from root down to (and including) the target node, with
  every node on that path *other than* the target and its descendants stripped of `children` outside the
  path (so ancestors show as single-child breadcrumb-like nodes, not their other branches), plus the
  target's own full subtree intact. Returns `null` if the target id isn't found (defensive — filter option
  list is always derived from the same tree, so this shouldn't happen, but don't let a stale selection
  crash the view).

## Tasks (small, do in order, one commit per task)

1. `ObjectiveTreeItemDto` + `getProjectTree` API method + a service spec test (mock HTTP, assert correct
   URL and response passthrough).
2. `buildObjectiveForest` in `project.mapper.ts` + unit tests: (a) flat list → correct nested tree; (b) a
   node with `isOwner: false` (ancestor-context-only) stays `isOwner: false` in the built node, not
   coerced to `true`; (c) empty/single-node input handled without throwing.
3. `ProjectDetailStore.loadProjectTree` replacing `loadMilestoneSubtree` + store spec updates (every
   existing spec that stubs/asserts `loadMilestoneSubtree` needs updating — grep `grep -rn
   loadMilestoneSubtree src/app/modules/work` first to find every call site, don't rely on the compiler to
   find them all since some may be in `.spec.ts` mocks with loose typing).
4. `MilestoneTreeTabComponent` fetch wiring (`loadProjectTree`) + spec updates, plus a manual note in the
   commit: confirm via the dev server that a caller who owns a nested child module actually sees the
   ancestor chain above it rendered (view-only per Part 5) rather than starting the tree at their own node.
5. `pruneTreeToModule` in `project.mapper.ts` + unit tests: (a) filtering to a module returns its full
   subtree plus a single-path ancestor chain, siblings-of-ancestors excluded; (b) `'all'` sentinel returns
   the tree unchanged; (c) an id not present in the tree returns `null` without throwing.
6. `ModuleFilterSelectComponent` + wiring into `MilestoneTreeTabComponent` (default selection =
   `:milestoneId`, options derived from the fetched tree's own objective nodes) + spec coverage: default
   selection matches the route's milestone id, changing the selection re-renders the pruned tree with no
   new HTTP call (assert this — spy on the API service and confirm it's not called again on filter change).

## Definition of done

- All 6 tasks committed individually.
- `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` fully green.
- Manual check (dev server): Tree tab for a project fetches the full reachable tree once; with the filter
  on the default (active) module it looks like today's single-module view; switching the filter to another
  owned module or "All modules" re-renders instantly with no network request.
