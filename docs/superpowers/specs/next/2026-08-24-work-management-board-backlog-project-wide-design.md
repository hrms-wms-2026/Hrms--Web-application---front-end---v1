# Work Management — Board & Backlog, Project-Wide (frontend design)

**Status:** Approved 2026-08-24 (brainstormed with user; two-plan split confirmed — this is Plan B,
functional/architectural. Plan A, a pure visual/theme-token pass across the whole module, is a separate
spec/plan, not started yet).

**Companion:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-24-work-management-board-backlog-project-wide-design.md`

**Baseline:** frontend `7631ef9`, backend `d01867cf` (both on
`feature/rewrite-project-management-19-08-2026-flow-chitect`).

**Scope:** Work Management module only — `src/app/modules/work/**`. Do not touch `layouts/main-layout`,
`organization`, `people`, `public`, or admin/platform. This is a real logic/routing/store change, not a
styling-only pass — noted explicitly since `docs/design/COMPONENT_DESIGN_RULES.md` governs *visual*
redesign passes (Plan A) and does not apply to this one.

## Goal

Move Board and Backlog from per-module (`work/:id/milestones/:milestoneId/(board|backlog)`) to
project-level (`work/:id/board`, `work/:id/backlog`) — siblings of the `settings` route added earlier.
Both show every module's sprints and tasks together, filterable by Module / Sprint / Category, Sprint
defaulting to Active. Sprint-less ("unsorted") tasks always show regardless of the Sprint filter. The
Tree tab is untouched — it stays module-scoped, still reachable under `milestones/:milestoneId`.

## What already exists — do not rebuild these

Verified by reading the actual components, not assumed:

- **`TaskCardComponent`** (Board's Kanban card) already has an explicit "View" button (👁, opens
  `TaskDetailModalComponent`) **and** an inline status `<select>` that calls `statusChangeRequested`
  **and** drag-and-drop still works via `CdkDropList`/`CdkDrag` in `task-board-column.component.ts`. The
  user confirmed "keep both" (drag-and-drop *and* dropdown) — both already coexist today. **No changes
  needed to `TaskCardComponent` for this spec.**
- **`TaskTableComponent`** (used by Backlog's `SprintTabComponent` and the "Unsorted" section) already has
  an explicit "View" button per row. **Status is read-only text** (`statusName(task.statusId)`) — this is
  the one real gap: add an inline status `<select>` here, mirroring `TaskCardComponent`'s pattern
  (`(click)="$event.stopPropagation()"` to avoid triggering row click, emit a new `statusChangeRequested`
  output carrying `{ taskId, newStatusId }`).

## Data flow

On Board/Backlog load: `forkJoin` of `GET /work/projects/{id}/objectives` (module names + per-module
`isOwner`, existing endpoint), the new `GET /work/projects/{id}/sprints`, and the new
`GET /work/projects/{id}/tasks` (see backend companion spec for both). Build an
`objectiveId → { title, isOwner }` map client-side from the objectives response — this drives the Module
filter's options and every row's Create/Edit/Delete/status-change permission (looked up by the
sprint/task's own `objectiveId`, since a user can own module A but not module B in the same project).

## Routing

`work.routes.ts`: `board` and `backlog` move out of the `milestones/:milestoneId` children array to become
siblings of `settings` under `:id` — same restructuring already done for `settings` earlier this session.
`work.routes.spec.ts` updated to match (same pattern as the `settings` route test update).

## Stores

- **`TaskBoardStore.loadBoard`**: replace the single `objectiveId` parameter with `projectId`, call the
  new `taskApi.getTasksByProject(projectId)` / `taskApi.getStatuses(projectId)` (already project-scoped
  since Manus's earlier migration) instead of the objective-scoped calls. `moveTask`/status-change logic
  is unchanged — it already operates on `taskId`, not `objectiveId`.
- **`SprintListStore`**: add `loadForProject(projectId)` calling the new `sprintApi.getByProject(projectId)`.
  `create`/`edit`/`complete`/`achieve`/`setStatus` still take an `objectiveId` (the write endpoints stay
  objective-scoped per the backend spec's "Out of scope" — creating a sprint still requires picking which
  module it belongs to), but their post-mutation reload switches from `load(objectiveId, ...)` to
  `loadForProject(currentProjectId)` when used from the project-wide Backlog.
- **`TaskApiService`/`SprintApiService`**: add `getTasksByProject(projectId)` →
  `GET /work/projects/{id}/tasks`, `getByProject(projectId)` → `GET /work/projects/{id}/sprints`. Existing
  per-objective methods (`getTasks`, `getByObjective`) stay — Tree tab still uses them.

## Filters (Board and Backlog, same filter bar component if practical)

- **Module**: dropdown from the objectives-map, "All" default.
- **Sprint**: dropdown from loaded sprints (name + dates), **defaults to whichever sprint has
  `status === 'active'`** if exactly one exists; "All" otherwise. Selecting a sprint filters visible
  tasks to that sprint's `sprintId` — **except** the filter must still surface sprint-less tasks
  (`sprintId === null`) even when a specific sprint is selected, per the user's explicit requirement — do
  not implement this as a strict `task.sprintId === selectedSprintId` filter; it must be
  `task.sprintId === selectedSprintId || task.sprintId === null` (or an explicit always-visible "Unsorted"
  section, matching Backlog's existing pattern for `unsortedTasks`).
- **Category**: dropdown from `taskApi.getCategories(projectId)` (existing project-scoped endpoint from
  the earlier Task Category work). Filters by `task.categoryId`.
- Backlog additionally keeps its existing sprint-status filter (`all/future/active/complete/incomplete/achieved`)
  — reframed as project-wide instead of per-module, same `<select>`, same values.

## Error handling

Standard four-state pattern (loading/error/empty/data), matching every other WM list view. `forkJoin`
failure (any of the 3 calls) surfaces one combined error with retry, same shape as `store.subtreeError()`
in the Tree tab.

## Testing

- `TaskApiService`/`SprintApiService`: new methods hit the right URLs (`projects/{id}/tasks`,
  `projects/{id}/sprints`).
- `TaskBoardStore`/`SprintListStore`: project-wide load populates state from the 3 aggregated calls;
  ownership map built correctly from the objectives response.
- `TaskTableComponent`: new inline status `<select>` emits `statusChangeRequested` with the right payload,
  doesn't trigger row-click/View when interacted with.
- Filter logic (wherever it lives — store or component): Sprint filter includes sprint-less tasks
  alongside the selected sprint's tasks; Module/Category filters narrow correctly; default Sprint filter
  picks the active sprint when there is exactly one.
- `work.routes.spec.ts`: updated for the route move.

## Out of scope

- `TaskCardComponent`, `TaskDetailModalComponent`, `TaskCreateModalComponent` — unchanged, already correct.
- Tree tab — stays module-scoped, no routing or store change.
- Plan A (visual/theme-token pass) — separate spec, not started.
- Any visual/CSS work beyond what's structurally required for the new filter bar to exist (Plan A covers
  making it look polished; this plan only needs it to work, using existing shared components/tokens
  as-is — e.g. reuse the existing `<select>` styling already used by `task-backlog__status-filter`).
