# Project Detail — Milestone Tree View — Design

**Status:** Approved 2026-08-10 (brainstormed same day, incl. browser mockup review). No plan written yet.
**Scope:** Full-stack — frontend (`Hrms--Web-application---front-end---v1`) page redesign + backend (`HRMS-Backend-v1`) DTO enrichment. One design doc covers both sides since it's one coherent feature; implementation plans are written per-repo per each repo's own `FILE_CREATION_RULES.md`.

## Problem

`ProjectDetailComponent` (`/work/projects/:id`) currently spends most of its vertical space on a header card + a horizontal scroller of milestone cards (see current `project-detail.component.html`), and only a small area below renders the selected milestone's subtree as plain nested boxes. This is the product's key differentiating page (user's words: "this page is very detail... it's my unique selling point") and the current layout under-serves the actual content — the milestone hierarchy.

## Current state (what exists today, confirmed by reading the code)

- `ProjectDetailStore.loadMyMilestones(projectId)` → `GET /work/projects/{id}/objectives/mine` — flat list of milestones the caller is a member of. Rendered today as the horizontal card row.
- `ProjectDetailStore.loadMilestoneSubtree(objectiveId)` → `GET /work/objectives/{id}/tree` — returns `{ parentObjective, objective: { ...fields, children: [...] } }`, i.e. the clicked node's parent (one level up, for context) plus its full nested descendant subtree. Currently only `objective` is mapped (`toMilestoneTreeNode`); `parentObjective` is discarded.
- `MilestoneTreeNodeComponent` — already exists, recursively renders `objective`'s subtree as nested bordered boxes with full detail (dates, hours) per node. Not a folder-tree visual, no expand/collapse, no click-to-reselect.
- `MilestoneSettingsModalComponent` + the store's `getMilestoneDetail`/`editMilestone`/`achieveMilestone`/`unachieveMilestone` — **working, approved, left untouched by this change.** Only the entry point (which UI element opens it) moves.

## Page structure

Four stacked/side-by-side cards (each an independent `app-card`, per user's explicit request — not one shared bordered box):

1. **Header card** — single line: project name, identifier, description inline (truncated), Start/Target/Hours stats right-aligned. Milestone card row **removed entirely**.
2. **Tab-bar card** — new generic `TabsComponent` (`shared/ui/tabs/`). One functional tab today: **Tree** (active). Additional tabs (`List`, `Board`, ...) are visually reserved as disabled placeholders for a later iteration — out of scope to build now.
3. **Tree card** (flex `2`) — the milestone hierarchy, explorer/folder-tree visual style (chosen in the browser mockup review: L-shaped connector lines, expand/collapse chevron, compact rows, VS Code file-explorer pattern).
4. **Detail card** (flex `1`) — the currently-focused milestone's detail (read-only) + a **⚙ gear** that opens the existing, unmodified `MilestoneSettingsModalComponent`.

## Interaction model: dynamic re-center

Confirmed behavior — **every** tree node click (root or any descendant, at any depth) does the same thing:

1. Call `store.loadMilestoneSubtree(clickedId)` again.
2. The tree redraws: a de-emphasized **parent context row** on top (from `response.parentObjective` — click it to go up one level, same re-center flow with the parent's id) + the clicked node's own full subtree below it, clicked node visually marked as focused.
3. The detail card repopulates from the **same response** (`response.objective`'s own fields) — no second network call per click.

Initial load (page open, nothing clicked yet): call `loadMyMilestones(projectId)` (kept, but **no longer rendered as cards** — used only to pick `milestones[0]` as the starting focused node, exactly matching today's existing fallback behavior), then `loadMilestoneSubtree(milestones[0].objectiveId)`.

Expand/collapse (chevron click) is local, presentation-only state — does not trigger a re-fetch or change focus/selection.

## Backend change required

Verified against the actual handlers — this is a real gap, not just a frontend mapping issue:

| Field | `GetObjectiveById` (`ObjectiveDetailResponse`) | `GetObjectiveSubtree` (`ObjectiveSubtreeNodeResponse`) |
|---|---|---|
| `IsAchieved`, `AchievedAt` | already present | **missing — add** |
| `OwnerName`, `ReportingManagerName` | **missing — add** | **missing — add** |
| `IsOwner` (drives the gear icon) | **missing — add** | **missing — add** |

Files:
- `ONEVO.Application/Features/WorkManagement/Objectives/DTOs/Responses/ObjectiveDetailResponse.cs` — add `OwnerName`, `ReportingManagerName`, `IsOwner`.
- `.../DTOs/Responses/ObjectiveSubtreeResponse.cs` (`ObjectiveSubtreeNodeResponse` record) — add `OwnerName`, `ReportingManagerName`, `IsOwner`, `IsAchieved`, `AchievedAt`.
- `.../Mappers/ObjectiveMapper.cs` — `ToDetail`/`ToSubtreeNode` need a name-lookup dictionary + current-user-id threaded through (same `IEmployeeRepository.GetByUserIdsAsync` pattern `GetMyProjectMilestonesQueryHandler` already uses — collect owner/reporting-manager ids recursively across the whole subtree, resolve once).
- `GetObjectiveByIdQueryHandler.cs` + `GetObjectiveSubtreeQueryHandler.cs` — inject `IEmployeeRepository`, build the lookup, pass to the mapper. `IsOwner` = `objective.OwnerId == _currentUser.UserId`, per node.
- No permission/route/status-code changes — same auth policy, same 403/404 semantics, additive fields only. Non-breaking.
- Update `docs/postman-request/Work Management/Get Objective.md` and `Get Objective Subtree.md` (backend `PROCESS_RULES.md` rule 6 — every finished endpoint change gets its doc kept current).

## Frontend changes

**Models/DTOs:**
- `ObjectiveDetailDto` — add `achievedAt: string | null` (backend already returns this on Get-Objective, frontend interface was just missing it), `ownerName: string | null`, `reportingManagerName: string | null`, `isOwner: boolean`. Drop the misleading "subtree never returns isAchieved" comment once the backend fix ships.
- `MilestoneTreeNode` (pure tree-render shape) stays minimal — `id`, `title`, `progress`, `isActive`, `children` — unchanged. It only drives the tree pane's rows; rich detail lives separately.
- New mapper `toObjectiveDetail(dto: ObjectiveSubtreeNodeDto): ObjectiveDetail` in `project.mapper.ts` (explicit, named — matches the codebase's existing mapper convention rather than a bare cast).

**Store (`ProjectDetailStore`):**
- Add `selectedSubtreeParent: { id: string; title: string } | null` and `selectedMilestoneDetail: ObjectiveDetail | null` to state.
- `loadMilestoneSubtree(objectiveId)` also patches these two from the same response — no new store method, no new API call.

**Components:**
- `shared/ui/tabs/tabs.component.ts` — new, generic, reusable (`input()` tab list + active id, `output()` change).
- `ui/milestone-tree-node/milestone-tree-node.component.ts` — reworked: explorer connector-line styling, local `expanded` signal per instance (chevron toggles it, doesn't emit), row click emits the node id upward (bubbles through recursion), selected-id input for highlight styling.
- New `ui/milestone-tree/milestone-tree.component.ts` — wraps the parent-context row + the recursive node tree, single `nodeSelected` output.
- New `ui/milestone-detail-panel/milestone-detail-panel.component.ts` — dumb, `input() milestone: ObjectiveDetail | null`, shows title/owner/reporting manager/dates/hours/progress/achieved badge, gear button visible only when `milestone().isOwner`, `output() settingsRequested`.
- `feature/project-detail/project-detail.component.ts` — replaces `onMilestoneSelected(milestone: Milestone)` with `onTreeNodeSelected(id: string)`; `onMilestoneSettingsRequested` keeps its existing body (calls `store.getMilestoneDetail`, unchanged), just re-wired to the detail panel's output instead of the card's.
- **Delete** `ui/milestone-card/milestone-card.component.ts` + its spec — the horizontal card row is gone and nothing else in the codebase uses this component (confirmed by search). YAGNI: rebuilt fresh if a future "Board" tab wants cards.

## Error / loading / empty states

- Tree card: `subtreeLoading()` → skeleton rows; `subtreeError()` → `app-error-state` with retry (existing store fields/pattern, just re-pointed).
- Detail card: populated synchronously from the same response as the tree — no independent spinner in the common path; shows a neutral "Select a milestone" placeholder only when nothing has loaded yet (should be rare given the auto-focus-first-milestone behavior).
- Empty project (zero milestones): tree card shows `app-empty-state`; detail card shows the same neutral placeholder. Never a blank area, per the frontend architecture doc's mandatory four-state rule.

## Testing

- Frontend unit: `project-detail.store.spec.ts` (new `selectedSubtreeParent`/`selectedMilestoneDetail` patch behavior), `project.mapper.spec.ts` (`toObjectiveDetail`), new specs for `TabsComponent`, reworked `MilestoneTreeNodeComponent` (expand/collapse vs. select-and-emit are independent), `MilestoneTreeComponent`, `MilestoneDetailPanelComponent` (gear visibility gated on `isOwner`). Update `project-detail.component.spec.ts` for the new wiring; delete `milestone-card.component.spec.ts`.
- Backend unit: extend the `GetObjectiveSubtreeQueryHandler`/`GetObjectiveByIdQueryHandler` tests for the new fields, plus one test proving `IsOwner` is computed per-caller (not leaked / not the same for every viewer of the same milestone).
- Manual/E2E: click through several levels of a seeded tree, confirm parent-context row re-centers correctly, confirm gear only shows for the milestone owner.

## Out of scope (this iteration)

- `List` / `Board` tabs — placeholders only, not built.
- Reparenting/drag-drop editing of the tree structure.
- Any change to `MilestoneSettingsModalComponent`'s internal Edit/Achieve/Unachieve logic — explicitly preserved as-is per user instruction; only its trigger location moves.
