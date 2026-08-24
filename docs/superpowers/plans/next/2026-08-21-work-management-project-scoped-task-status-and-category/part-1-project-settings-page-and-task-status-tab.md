# Part 1: New Project-level Settings page, Task Status tab re-pointed at the Project-scoped API

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-work-management-project-scoped-task-status-and-category-design.md`
§6. **Hard prerequisite:** the backend repo's companion plan Part 1
(`2026-08-21-work-management-project-scoped-task-status-and-category/part-1-collapse-task-status-to-project-scope.md`)
must ship first — this Part calls the new `projects/{projectId}/task-statuses` routes it creates, not
the old `objectives/{objectiveId}/task-statuses` ones.

**Scope guard:** Work Management module only: `src/app/modules/work/**`, plus one small addition to
`ProjectDetailComponent`'s own template (still inside `work/**`).

## Goal

Today, Task Status settings live at `work/:id/milestones/:milestoneId/settings`
(`ObjectiveSettingsComponent`) — reached only from inside a specific Module's own tab bar. Move this to
a new Project-level page at `work/:id/settings`, reached via a new settings icon on the Project detail
header, with two tabs: Task Status (this Part) and Task Category (Part 2). `BoardStructureEditorComponent`
(the drag-reorder editor itself) is reused as-is per the user's confirmation that its UI is fine — only
what feeds it (the `objectiveId` input, and the three `TaskApiService` calls it makes) changes to
`projectId`.

## Current state (verified by reading the files directly)

- `work.routes.ts` — `settings` is currently a child route of `milestones/:milestoneId`
  (`ObjectiveSettingsComponent`, full route list already read). No Project-level settings route exists
  today.
- `ObjectiveSettingsComponent` (full content already read) — reads `objectiveId` from
  `route.parent?.snapshot.paramMap.get('milestoneId')`, calls `taskApi.getStatuses(objectiveId)`, renders
  `<app-board-structure-editor [objectiveId]="objectiveId" [statuses]="statuses()" ... />`.
- `BoardStructureEditorComponent` — `objectiveId = input.required<string>()`; uses it in
  `taskApi.createStatus(this.objectiveId(), ...)` and `taskApi.reorderTaskStatuses(this.objectiveId(),
  ...)`. `editStatus`/`deleteStatus` calls don't take an objective/project id at all (id-only routes,
  unaffected by this rename).
- `TaskApiService` (full content already read) —
  `getStatuses(objectiveId)`/`createStatus(objectiveId, ...)`/`editStatus(objectiveId, id, ...)`/
  `reorderTaskStatuses(objectiveId, updates)` all build URLs under `${baseUrl}/objectives/${objectiveId}/task-statuses...`.
  Note `editStatus` also takes `objectiveId` as a param even though it's unused in the URL
  (`patch(.../objectives/${objectiveId}/task-statuses/${id})`) — the backend plan's Part 1 changes this
  route shape too; re-verify the exact new route path against that plan (or the shipped backend code, if
  it's already merged) before wiring this method, don't assume it's identical to the old shape with just
  the segment renamed.
- `project-detail.component.html` — no existing settings/gear icon; uses a shared
  `<app-breadcrumb-header parentLabel="Projects" [currentLabel]="project.name" parentUrl="/work"
  icon="work" />` at the top. This Part adds a small icon button near it — check
  `BreadcrumbHeaderComponent`'s own template/inputs first for whether it already supports a trailing
  action slot before adding a sibling element outside it; use whichever is cleaner, this wasn't traced
  during design.

## Files to create

- `src/app/modules/work/feature/project-settings/project-settings.component.ts` (+ `.spec.ts`)
- `src/app/modules/work/feature/project-settings/task-status-settings-tab.component.ts` (+ `.spec.ts`) —
  thin wrapper, same shape as today's `ObjectiveSettingsComponent` but Project-scoped (rename, don't
  literally move the old file, since Part 2 needs `ProjectSettingsComponent` to own the tab switcher)

## Files to modify

- `src/app/modules/work/work.routes.ts` — add a sibling route to `milestones/:milestoneId` under `:id`:
  ```typescript
  {
    path: 'settings',
    loadComponent: () =>
      import('./feature/project-settings/project-settings.component').then((m) => m.ProjectSettingsComponent)
  }
  ```
- `src/app/modules/work/data-access/task-api.service.ts` — `getStatuses`, `createStatus`, `editStatus`,
  `reorderTaskStatuses`: rename the `objectiveId` param to `projectId` and update the URL segment from
  `objectives/${objectiveId}` to `projects/${projectId}` (re-verify exact final route shape against the
  backend Part 1 plan/shipped code first, per the note above).
- `src/app/modules/work/ui/board-structure-editor/board-structure-editor.component.ts` — rename
  `objectiveId` input to `projectId`, update its two internal usages.
- `src/app/modules/work/feature/project-detail/project-detail.component.html` +
  `project-detail.component.ts` — add the settings icon button, routing to `../settings` relative to the
  current Project id.
- Delete `src/app/modules/work/feature/objective-settings/` (component + spec) entirely — superseded by
  this Part. Confirm nothing else references `ObjectiveSettingsComponent` first
  (`grep -rln "ObjectiveSettingsComponent" src/`).

## Task 1: `ProjectSettingsComponent` shell with tab switcher

New component, reads `projectId` from `route.snapshot.paramMap.get('id')` (same param name the existing
`:id` route segment already uses — confirm by reading how `ProjectDetailComponent` itself reads its own
`id` param, match that exact pattern). Renders a simple two-tab switcher (`Task Status` / `Task
Category`, signal-based active-tab state, matching this codebase's existing tab-switcher pattern
elsewhere in the module if one exists — check `milestone-tree-tab` or a similar multi-tab feature
component for the established convention before inventing a new one) and shows
`TaskStatusSettingsTabComponent` (this Part) or `TaskCategorySettingsTabComponent` (Part 2) based on the
active tab.

## Task 2: `TaskStatusSettingsTabComponent`

Copy `ObjectiveSettingsComponent`'s current body, rename `objectiveId` → `projectId`, source it from the
parent-provided `projectId` (an `input.required<string>()` from `ProjectSettingsComponent`, not a route
read of its own — the route param is already resolved once, at the `ProjectSettingsComponent` level).
Everything else (the `reload()` method, the `<app-board-structure-editor>` usage) stays the same shape,
just with the renamed input.

## Task 3: `TaskApiService` and `BoardStructureEditorComponent` renames

Mechanical rename per "Files to modify" above. Re-run every existing spec for both files after the
rename — `task-api.service.spec.ts` and `board-structure-editor.component.spec.ts` (found earlier via
grep) almost certainly construct requests/inputs keyed on `objectiveId` today and need their mock data
and assertions updated to `projectId`, not just the production code.

## Task 4: Settings icon + route wiring

Add the icon button and route per "Files to modify." Test: a routing test (or component test navigating
via `Router`) confirming the icon click lands on `work/:id/settings` and `ProjectSettingsComponent`
renders.

## Task 5: Delete the old Objective-scoped settings

Remove `objective-settings/` entirely, remove the `settings` child route from `milestones/:milestoneId`
in `work.routes.ts`. Grep-confirm no remaining references before deleting
(`grep -rln "ObjectiveSettingsComponent\|objective-settings" src/`).

## Task 6: Full regression pass

`npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` green. Read the output, not just
pass/fail count — a rename this broad (input name + URL shape) is exactly the kind of change that can
leave one stale mock passing for the wrong reason.

## Definition of done

- Tasks 1-5 each committed individually.
- Task 6's full `work` module suite is green.
- Manually verify in a browser (once the backend companion Part 1 is also live) that the Task Status tab
  loads the Project's shared statuses, and editing one is reflected immediately without a full page
  reload.
