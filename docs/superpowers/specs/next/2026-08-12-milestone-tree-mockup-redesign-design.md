# Project Detail — Unified Tree-Table Redesign (Manager Mockup) — Design

**Status:** Approved 2026-08-12 (brainstormed same day against a manager-supplied mockup screenshot; scope narrowed via direct Q&A — "visual restyle only, real data", unified tree replaces cards+per-module-tab). Implemented 2026-08-12, then **partially reverted the same day**: scope decision #2 below ("unified tree, not cards + per-module tab") was wrong — a project can have multiple independent top-level modules (a `project_members`-visible forest, not a single-rooted tree), so collapsing everything into one project-root tree via the flat `isDefault` lookup silently hid every module except the default one. Corrected same day: the card grid and Tree/Board/Backlog/My Task/List sub-menu are restored exactly as `2026-08-11-project-detail-milestone-tree-explorer-design.md` had them; only the *contents* of the per-module Tree tab keep this design's table-row styling, owner avatar, due-date column, and Create sub Module flow. Scope decision #2 and the "Unified tree" framing throughout this document are superseded by that correction — read the rest of this doc as describing the Tree tab's internals only, not the page-level navigation.

## Problem

The user's manager supplied a mockup (generic project-management tree table: `Onexso Workspace` root, expandable rows, columns Work item/Type/Milestone/Progress/Owner/Status/Due date, a right-side "Project Structure" detail panel with progress ring, task counts, and "View details" / "+ Add under X" actions) and asked for the current Work Management milestone tree to move toward that direction — but **not** multi-color per-user avatars (team/single color instead), no "View details" button, the add-button renamed to "Create sub Module", and the whole thing wired to real APIs end to end.

This supersedes the navigation shape introduced by the (approved, apparently unimplemented per `specs/next/SUMMARY.md` bookkeeping, but already live in code) `2026-08-11-project-detail-milestone-tree-explorer-design.md`: milestone card row + per-module sub-menu (Tree/Board/Backlog/My Task/List) + a ~62/38 split tree+panel box. That shape is replaced by one full-width tree-table rooted at the project itself.

## Scope decisions (confirmed with user)

1. **Visual restyle only, real data.** The mockup's `Type` taxonomy (Project Root/Major Module/Module/Work Package/Feature/Task/Container/Workstream), `Milestone` release-tag column (R1/R2 Direct/Inherited), `Status` workflow (Active/On track/At risk/Overdue/Planned), and task-count KPIs have no backing data anywhere in the current Objective model or any other endpoint. These are dropped, not faked.
2. **Unified tree**, not cards + per-module tab. The tree is rooted at the project (using already-loaded `ProjectDetail`) and shows the full Objective hierarchy at once — our data already supports arbitrary nesting via `parentObjectiveId`, so there is no structural reason to gate it behind a top-level card selection first.
3. **Board/Backlog/My Task/List sub-tabs are dropped from this view.** They are non-functional stubs (`MilestoneComingSoonTabComponent`) with no equivalent in the mockup. Their route files and component stay in the repo untouched, just unreferenced from Project Detail's default view.
4. **Owner avatars reuse the existing shared `app-avatar` component as-is** (`src/app/shared/ui/avatar/avatar.component.ts`) — it is already single-color (`--color-profile-bg`) with initials, never per-user multi-color. No new avatar component needed.

## Confirmed backend bug (in scope — Objectives feature, Work Management)

Verified by reading the actual handler/DTO/mapper source (not just the Postman docs, which describe the intended-but-undelivered shape):

- `GetObjectiveByIdQueryHandler` and `GetObjectiveSubtreeQueryHandler` both correctly **compute** `OwnerName`, `ReportingManagerName`, `IsOwner` (and, for subtree, `IsAchieved`/`AchievedAt` per node) onto their Application-layer response DTOs (`ObjectiveDetailResponse`, `ObjectiveSubtreeNodeResponse` — confirmed, both records carry these fields).
- Neither field reaches the wire. `ObjectiveDetailViewModel` and `ObjectiveSubtreeNodeViewModel` (`src/ONEVO.Api/Contracts/WorkManagement/Objectives/*.cs`) were never updated with these fields when they were added 2026-08-10, and `ObjectiveViewModelMapper.ToViewModel()` silently drops them in the DTO→ViewModel conversion.
- This is exactly the class of gap `docs/superpowers/project_ core/ONEVO_Backend_Architecture_Document.md` §2.1.1.1 warns about ("a retrofit must not change the JSON actually sent over the wire" — here the Application layer moved forward on 2026-08-10 but the View Model layer never followed, so the wire response silently reverted to the pre-2026-08-10 shape).
- Confirms and closes the "Confirmed API gap" the 2026-08-11 spec explicitly deferred ("Panel 8 will omit the Owner/Reporting Manager fields entirely for now... a separate, future spec").

**Fix (backend, `HRMS-Backend-v1`):** add the missing fields to both ViewModel records and pass them through in `ObjectiveViewModelMapper`. No Application/Domain/Infrastructure change — the data is already computed correctly; only the two-line ViewModel + one mapper line are wrong. No migration, no new endpoint. See companion note `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-12-objective-viewmodel-owner-fields-fix-design.md`.

## Data flow

No new backend endpoints. Three existing endpoints, used differently than today:

1. On Project Detail load: `GET /work/projects/{id}/objectives` (flat, existing `getObjectiveTree`-style call — not currently used by the frontend, `ObjectivesController.GetTree`) to locate the node with `isDefault === true` → that is the project's root Objective id. This call's flat, sparse shape (`ObjectiveTreeItemViewModel` — no owner name) is used only to find the root id, nothing else.
2. `GET /work/objectives/{rootId}/tree` (existing `getMilestoneSubtree`, `ObjectivesController.GetSubtree`) — once the backend fix above lands, this returns the **entire** nested tree in one call, every node carrying title/progress/dates/hours/description/ownerName/isOwner/isAchieved. This one call replaces both the old per-top-level-milestone subtree fetch and the separate per-node `GetObjectiveById` detail fetch — clicking a row just reads the already-fetched node from the tree response and shows it in the detail panel. No network call on row click.
3. `POST /work/objectives` (existing `CreateObjectiveCommand`/`ObjectivesController.Create` — already fully built server-side, never called from the frontend until now) — the new "Create sub Module" flow. Payload: `parentObjectiveId` (the clicked/selected node), `title`, `description` (optional), `startDate`, `endDate`, `allocatedHours`, `headUserId` (optional). Permission is enforced server-side (caller must be the parent's current Head — i.e. `isOwner` on that node); the button is client-side gated on `node.isOwner` for UX only, per `ONEVO_Backend_Architecture_Document.md` §3.4 ("frontend button visibility is only for user experience... hidden buttons must never be treated as security").

`editObjective`/`achieveObjective`/`unachieveObjective` (existing `MilestoneSettingsModalComponent` flow) are unchanged — still triggered from a row's settings affordance, same as today's card settings button.

## Component architecture

| Component | Change |
|---|---|
| `ProjectDetailComponent` (`feature/`) | Reworked: no more milestone card row / sub-menu / router-outlet-per-tab. Owns the unified tree load (steps 1–2 above) and renders the tree + detail panel directly, below the existing project header. |
| `MilestoneTreeNodeComponent` (`ui/`, reworked) | Row becomes a table row: chevron + indented title, progress (%, bar), owner (`app-avatar`, `size="sm"`, initials from `ownerName`), due date (`endDate`). Achieved shown as a small pill, matching current `MilestoneCardComponent` badge style. A per-row "+" affordance (visible only when `isOwner`) opens the create-sub-module modal with `parentObjectiveId` preset. Column header row added once, in the new tree-table container, not per node. |
| `MilestoneDetailPanelComponent` (`ui/`, reworked) | Add `app-avatar` for owner (reusing `ownerName`, once the backend fix lands). No "View details" button — the panel already renders full detail inline, matching the manager's instruction not to add one. Add "+ Create sub Module" button, visible only when `detail.isOwner` is true, emitting a new `createSubRequested` output. |
| `MilestoneSettingsModalComponent`, `MilestoneCardComponent`, `MilestoneSubMenuComponent`, `MilestoneComingSoonTabComponent` | `MilestoneCardComponent` and `MilestoneSubMenuComponent` are no longer used by `ProjectDetailComponent` (dropped from this flow per scope decision #3) but not deleted — still referenced by their own specs; left in the repo as unreferenced-but-intact per module conventions (matches how `2026-08-11`'s own components were kept when superseding earlier layouts). `MilestoneSettingsModalComponent` stays wired, now triggered from the tree row/detail panel instead of the card. |
| New: `CreateSubModuleModalComponent` (`ui/`) | Form modal: title, description, start/end date, allocated hours, optional head user (reuse existing form patterns from `MilestoneSettingsModalComponent`/`ProjectFormModalComponent`). Emits the create payload; parent component calls the new store method and closes on success. |
| `ProjectDetailStore` (`state/`) | New `loadProjectTree(projectId)`: does step 1 (find root via flat tree call) then step 2 (subtree call), replacing `loadMilestoneSubtree`'s old per-milestone-id entry point — the store now derives the root internally instead of receiving an id from the route. `clearNodeDetail`/`loadNodeDetail` are removed — no longer needed since node detail comes from the already-fetched tree, not a separate call. New `createSubModule(parentObjectiveId, payload)` method wrapping the existing `ProjectApiService` (needs one new method, `create`, mirroring `CreateObjectiveRequestDto`). |
| `ProjectApiService` (`data-access/`) | Add `getObjectiveTreeFlat(projectId)` (→ `GET /work/projects/{id}/objectives`) and `createObjective(payload)` (→ `POST /work/objectives`). `getObjectiveById` becomes unused by this flow (kept — `MilestoneSettingsModalComponent` still calls `getMilestoneDetail`/`getObjectiveById` via `store.getMilestoneDetail`, unchanged). |

## Routing

`work.routes.ts`: the `milestones/:milestoneId/(tree|board|backlog|my-task|list)` child routes are removed from under `':id'`. `ProjectDetailComponent` becomes a single component with no child `<router-outlet>` for this feature — matches the mockup's single-page tree, and removes now-dead routes for a flow no longer reachable from the UI. `work.routes.spec.ts` updated accordingly.

## Styling

- Reuses `app-avatar` (`shared/ui/avatar`) unchanged — already single team color, no per-user variance, exactly per the "not multi color" instruction.
- Table row styling: existing `--color-border`, `--color-surface`, `--color-focus-ring` tokens per `COMPONENT_DESIGN_RULES.md` — no new colors.
- Chevron icon: reuse the existing inline SVG pattern already in `MilestoneTreeNodeComponent` (`ICON_THEME_SYSTEM.md` compliant), just repositioned into a table-row layout.
- "+ Create sub Module" button: reuses the existing primary-button style already used for "+ Add Employee"/"+ Add Project" patterns elsewhere in the module.

## Error handling

Standard four-state pattern (loading/error/empty/data) per `ARCHITECTURE.md` §7.4, on the single combined tree load. `createSubModule` surfaces validation errors (400 — date/hours outside parent's range) and 403 (not current Head) inline on the create modal, same pattern as `MilestoneSettingsModalComponent`'s existing `errorMessage` input.

## Opportunistic pickup: already-approved "Module" display-rename

`2026-08-12-milestone-to-module-display-rename-design.md` (approved same day, no plan written yet) changes 6 literal display strings ("Loading milestones…" → "Loading modules…", "Milestone settings" → "Module settings", etc.) across files this redesign already touches (`project-detail.component.html`, `milestone-settings-modal.component.ts`, `project-detail.store.ts`). Since the diff overlaps directly, these 6 edits are folded into this implementation rather than done as a separate pass — no scope expansion beyond what that spec already approved. The backend `module_catalog.name` companion migration in that spec is **not** part of this work (unrelated to the Objectives API surface).

## Out of scope

- Type taxonomy, release-milestone (R1/R2) tags, Status workflow, task counts/KPI header — no backing data (scope decision #1).
- Board/Backlog/My Task/List real functionality.
- Any change to `ProjectListComponent`/`ProjectCardComponent`.
- The backend `module_catalog.name` migration from the display-rename spec's backend companion.

## Testing

Standard TDD per component/store (existing Vitest + Angular TestBed conventions):
- `MilestoneTreeNodeComponent`: renders as a table row with progress/owner/due-date; chevron toggles expand without selecting; row click selects without toggling; "+" only shows when `isOwner`.
- `MilestoneDetailPanelComponent`: four states; owner avatar renders from `ownerName`; "+ Create sub Module" only shows when `isOwner`; no "View details" button exists.
- `CreateSubModuleModalComponent` (new): field validation, submit calls the store method with the right `parentObjectiveId`, closes on success, surfaces server error on failure.
- `ProjectDetailStore`: `loadProjectTree` resolves the root via the flat call then loads the subtree; `createSubModule` success/error paths.
- `ProjectApiService`: new `getObjectiveTreeFlat`/`createObjective` methods hit the right URLs.
- `work.routes.spec.ts`: updated for the removed child routes.
