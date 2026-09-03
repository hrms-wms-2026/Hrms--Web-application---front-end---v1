# Design: Work Management — Projects List, Project Detail, Milestone (Objective) Read View

**Date:** 2026-08-08
**Status:** Implemented 2026-08-09 — see `plans/finished/2026-08-09/2026-08-09-work-management-projects-milestones.md` for the implementation plan and its execution report.
**Base reference:** [ARCHITECTURE.md](../../../core/ARCHITECTURE.md)
**Related:** `docs/superpowers/plans/next/Project Management.md` (an earlier, manager-rejected UI submission for this same area) — **explicitly not applied here** per user decision 2026-08-08: that doc depends on approval-workflow/archive-with-reason backend endpoints that do not exist. This design targets today's real API only.
**Backend dependency (resolved 2026-08-09):** `HRMS-Backend-v1/docs/superpowers/plans/finished/2026-08-09/2026-08-08-work-management-frontend-blocking-endpoints.md` — both additions (§6) shipped before implementation started, so the category filter/dropdown and the achieved badge/filter described below as blocked are fully wired, not disabled placeholders.

## Scope

Build the Work Management module's Projects surface end-to-end (skeleton markup + logic together — no separate design hand-off exists yet, per user decision): a Project list page, a Project Detail page, and a read-only Milestone (Objective) view reached from Project Detail. Gate the "Work" nav button on the `projects:access` permission.

**In scope:**
- Project List (`/work`): cards, two filters (category, active/archived), Create button, per-card View button, per-card Edit/Achieve buttons for the project's lead only.
- Create / Edit / Delete / Achieve / Unachieve Project — all via modal popups.
- Project Detail (`/work/:id`): project info + the caller's milestones in that project (**My Project Milestones**), read-only.
- Milestone Subtree (reached by clicking a milestone on Project Detail): that milestone plus its nested children (**Get Objective Subtree**), read-only.
- Nav/route permission gating on `projects:access`.

**Out of scope (explicitly deferred, confirmed with user):**
- Any milestone mutation — create sub-milestone, edit, delete, transfer head, add/remove member, achieve/unachieve. These branch into a pending-approval (`202`) flow routed to a Reporting Manager, with a separate Change-Request approve/reject inbox (`Approve/Reject/List My Objective Change Requests`) — a distinct, larger piece of work.
- Everything in the rejected `Project Management.md` doc that depends on unbuilt backend concepts: approval pipeline, workflow status, archive-with-reason, schedule health, three-dot menu redesign, multi-step create form. If the backend later builds those, this design does not need to be redone — it targets today's simpler Create/Edit/Delete/Achieve/Unachieve contract, which stays valid underneath any future UI polish.

## Current state

`/work` is registered in `app.routes.ts` pointing at the generic `PlaceholderPageComponent` (`shared/feature/placeholder-page/`). No `src/app/modules/work/` directory exists. The `work` nav item in `nav-items.config.ts` currently gates only on `requiredModules` (`worksync_foundation`, `projects`, `objectives_milestones`, `tasks`, `boards`, `planning_sprints`) — it has no `requiredPermissions` entry, unlike `organization`, which gates on both module and permission. No branch (local or `origin/*`) contains any Work/Project skeleton markup — this design produces it fresh.

## Backend endpoints this design consumes (all already exist)

| Action | Method + path | Notes |
|---|---|---|
| List my projects | `GET /api/v1/work/projects/mine` | Paged; `ProjectListItemViewModel` — see §6 for the two fields it's missing |
| Get one project | `GET /api/v1/work/projects/{id}` | Includes `isAchieved`/`achievedAt` already (view/edit permission read path) |
| Create project | `POST /api/v1/work/projects` | `multipart/form-data`; idempotent via `Idempotency-Key` |
| Edit project | `PUT /api/v1/work/projects/{id}` | Lead-only; `identifier` immutable |
| Delete project | `DELETE /api/v1/work/projects/{id}` | Lead-only; soft delete |
| Achieve project | `POST /api/v1/work/projects/{id}/achieve` | Lead-only; `400` if a top-level milestone isn't achieved yet |
| Unachieve project | `POST /api/v1/work/projects/{id}/unachieve` | Lead-only |
| My milestones in a project | `GET /api/v1/work/projects/{projectId}/objectives/mine` | Every milestone the caller has ever had membership on, any status — frontend filters |
| Milestone subtree | `GET /api/v1/work/objectives/{id}/tree` | Head-only; parent + full nested children |

## Architecture

New `src/app/modules/work/`, following the existing domain-module layering (`ARCHITECTURE.md` §2):

```
modules/work/
├── feature/
│   ├── project-list/          project-list.component.{ts,html,css}
│   └── project-detail/        project-detail.component.{ts,html,css}
├── ui/
│   ├── project-card/
│   ├── project-filter-bar/
│   ├── project-form-modal/     — shared by Create and Edit (same fields, per user description)
│   ├── project-achieve-confirm-modal/
│   ├── project-delete-confirm-modal/
│   └── milestone-tree-node/    — recursive node renderer for the subtree view
├── data-access/
│   └── project-api.service.ts  — Projects + the two read-only Objective endpoints in scope
├── state/
│   ├── project-list.store.ts   — list, filters, pagination, loading/error
│   └── project-detail.store.ts — one project + its milestone list/subtree, loading/error
├── models/
│   ├── project.model.ts
│   ├── project-filter.model.ts
│   ├── milestone.model.ts
│   └── dto/ (request/response DTOs mirroring the backend view models above)
├── utils/
│   └── project.mapper.ts       — DTO → view model mapping (dates, achieved badge text, etc.)
└── work.routes.ts
```

`work.routes.ts` is lazy-loaded from `app.routes.ts`, replacing the current placeholder entry:

```ts
{
  path: 'work',
  canActivate: [permissionGuard],
  data: { permissions: ['projects:access'] },
  loadChildren: () => import('./modules/work/work.routes').then(m => m.WORK_ROUTES)
}
```

`WORK_ROUTES` = `''` → `ProjectListComponent`, `':id'` → `ProjectDetailComponent`. This mirrors the `organization` route's existing `permissionGuard` usage exactly.

`nav-items.config.ts`'s `work` entry gains `requiredPermissions: ['projects:access']` alongside its existing `requiredModules`, so `canAccessNavItem`'s AND logic (module gate AND permission gate) hides the button unless both pass — same pattern `organization` already uses.

## State management

Two `@ngrx/signals` stores (`ARCHITECTURE.md` §4 pattern — `withState`/`withComputed`/`withMethods`, no `BehaviorSubject`):

**`ProjectListStore`** — `projects: Project[]`, `pageNumber/pageSize/totalCount`, `filters: { categoryId: string | null; achievedFilter: 'active' | 'archived' | 'all' }`, `loading`, `error`. Methods: `loadProjects()`, `setFilter(...)`, `createProject(...)`, `editProject(...)`, `deleteProject(...)`, `achieveProject(...)`, `unachieveProject(...)` — each mutation invalidates and reloads the list (matching the `EmployeeService` cache-invalidation pattern in `ARCHITECTURE.md` §4.5, since Delete/Achieve have no optimistic-patch-friendly response body).

**`ProjectDetailStore`** — `project: Project | null`, `milestones: Milestone[]`, `selectedMilestoneSubtree: MilestoneSubtree | null`, `loading`, `error`. Methods: `loadProject(id)`, `loadMyMilestones(projectId)`, `loadMilestoneSubtree(objectiveId)`.

Local UI state (which modal is open, filter-bar expanded, selected milestone id before its subtree loads) stays as component `signal()`, never in the store, per `ARCHITECTURE.md` §4.1.

## Screens

### Project List (`/work`)

- `ProjectFilterBarComponent`: two `app-select` filters — Project Category (options from the new categories endpoint, see §6; disabled/hidden with a tooltip until that endpoint ships) and Active/Archived (`Active` | `Archived` | `All`, driven by `isAchieved` — see §6 for why this is currently unavailable server-side).
- Create button (`app-button`, primary) opens `ProjectFormModalComponent` in create mode.
- Grid of `ProjectCardComponent`, one per `Project`: name, identifier, category, dates, allocated/completed hours, achieved badge (once §6 lands). Actions: **View** (always, routes to `/work/:id`); **Edit** and **Achieve/Unachieve** shown only when `project.isLead` is true (the list response already includes `isLead` today — no backend gap here).
- Four mandatory states per `ARCHITECTURE.md` §7.4: loading (skeleton grid), error (`app-error-state` + retry), empty (`app-empty-state`, "No projects yet" + Create action), data (the grid).

### Create / Edit Project (popup)

One `ProjectFormModalComponent` (`app-modal`) used for both, per your description ("create/edit... popup"). Fields per the real `Create Project`/`Edit Project` contracts: name, identifier (create-only, immutable after), category (select), description, start/target date, color, allocated hours, labels (create-only), logo upload (create-only). Edit reuses the same field set minus the create-only ones. Submit calls `ProjectListStore.createProject`/`editProject`; on success closes the modal and the list re-renders from the invalidated store.

### Delete confirm (popup)

Small `app-modal` confirmation ("Delete project '{name}'? This cannot be undone.") — matches the real `DELETE` contract (hard soft-delete, `409` if already deleted). No archive-with-reason UI (that's the rejected-doc territory, out of scope).

### Achieve / Unachieve (popup)

Small `app-modal` confirmation. Achieve surfaces the real `400` case ("A top-level milestone isn't yet Achieved") as an inline error if the API returns it, rather than blocking optimistically client-side (the list doesn't know milestone-achieved state without an extra call — not worth adding for a confirm dialog).

### Project Detail (`/work/:id`)

- Header: project name/identifier/category/dates/description/hours, Edit/Achieve actions again if `isLead` (from `GET /work/projects/{id}`, which already returns `isLead` and — unlike the list — already returns `isAchieved`/`achievedAt` today, no gap here).
- Milestone list section: results of **My Project Milestones**, rendered flat (title, owner name, reporting manager name, dates, hours, achieved status, membership-active status) — the endpoint returns non-active/removed rows too, so the UI must show/label those distinctly (e.g. muted row + "no longer a member" tag) rather than filtering them out silently.
- Clicking a milestone calls **Get Objective Subtree** and renders the result via the recursive `MilestoneTreeNodeComponent` (title, dates, hours, progress, achieved) — read-only, no action buttons on any node this round.
- Same four-state pattern (loading/error/empty/data) applies to both the project header and the milestone section independently, since they load from separate calls.

## Error handling

Nothing new beyond `ARCHITECTURE.md` §7 (global error taxonomy + interceptor already handle 401/403/404/409/422/500 uniformly). Two contract-specific cases the UI must handle explicitly because they're not generic:
- Achieve Project `400` ("top-level milestone isn't achieved yet") — shown inline in the achieve-confirm modal, not just as a banner.
- Edit Project `400` when the request body includes a changed `identifier` — the form must omit `identifier` from the PUT payload entirely (per the contract: "omit to skip the immutability check"), not just disable the field, so a stray value never gets sent.

## Testing

Every new file gets a co-located `.spec.ts`, matching the existing convention (`employee.store.spec.ts`, `has-permission.directive.spec.ts`, etc.) — store methods (success/failure branches), the mapper (DTO → view model), `canAccessNavItem`-style coverage isn't needed again (already tested) but the new `nav-items.config.ts` entry's permission string is worth a one-line assertion alongside the existing `nav-access.spec.ts` if that file already parametrizes over `NAV_ITEMS`.

## §6. Backend dependency (blocking two specific pieces, not the whole module)

Confirmed by reading the actual backend C# source (not just the Postman docs, which are stale here), full detail in `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-08-work-management-frontend-blocking-endpoints.md`:

1. **No endpoint lists Project Categories** anywhere in Work Management (only `ProjectsController`/`ObjectivesController` exist). Blocks: the category `app-select` in the Create/Edit modal, and the category filter on the list page.
2. **`ProjectListItemViewModel` (used by `GET /work/projects/mine`) has no `IsAchieved`/`AchievedAt`**, unlike `ProjectDetailViewModel` which already has both. Blocks: the Active/Archived filter and the achieved badge on cards, without an N+1 `GET /work/projects/{id}` call per card.

**Until these ship:** the category select and Active/Archived filter render disabled with a short explanatory label (e.g. "Coming soon"); everything else in this design (list, create/edit/delete/achieve/unachieve, detail, milestone read view) works fully against today's API. This is a deliberate two-piece gate, not a reason to hold the whole module — confirmed with the user 2026-08-08.
