# Project Detail — Milestone Sub-Menu, Explorer Tree, and Detail Panel — Design

**Status:** Approved 2026-08-11 (brainstormed same day, with a visual mockup the user approved — Option A "Explorer / folder-tree" style, root expanded / children collapsed by default). No plan written yet.

## Problem

Project Detail (`/work/:id`) today renders the selected milestone's full subtree inline via `MilestoneTreeNodeComponent` — always-expanded, no per-node selection, no detail panel, and no way to switch between different views of a milestone (Tree, Board, Backlog, My Task, List). The user wants:

1. A sub-menu under the milestone card row, one tab per view (Tree/Board/Backlog/My Task/List), Tree selected by default.
2. The Tree tab reworked into an **explorable, folder-style** tree (expand/collapse per node, connector lines) side-by-side with a **detail panel** that shows the full detail of whichever node is currently selected.
3. Board/Backlog/My Task/List are out of scope for this round — stub pages only, wired into real routes so the tab navigation and URL structure are correct from day one.

This builds directly on the existing Work Management module (`docs/superpowers/plans/finished/2026-08-09/2026-08-09-work-management-projects-milestones.md` and the 2026-08-10 milestone-cards/tree-view and inline-milestone-layout specs) — no new backend feature, only frontend restructuring plus reuse of two existing endpoints.

## Prior-decision reconciliation (important context)

On 2026-08-10, a dedicated route (`/work/:projectId/milestones/:objectiveId`) for milestone detail was **deliberately removed** in favor of an inline panel on the same Project Detail page, because the user's manager wanted "no navigate away" — see `2026-08-10-project-detail-inline-milestone-layout-design.md`.

This design reintroduces URL state (milestone id + active tab) but **without reintroducing the navigate-away problem**: `ProjectDetailComponent` stays mounted as a permanent shell (project header card + milestone card row never unmount or reload); only a child `<router-outlet>` below it swaps content per tab. Visually this is indistinguishable from the removed route's problem case — no flicker, no full-page reload — while gaining correct browser back/forward and refresh behavior, which the user asked for this round (see "Back entry position check" below). Confirmed with the user directly before proceeding.

## Routing

```
work.routes.ts
├── ''                                    → ProjectListComponent (unchanged)
└── ':id'                                 → ProjectDetailComponent (shell — header + milestone row + <router-outlet>)
      └── 'milestones/:milestoneId'
            ├── '' → redirectTo 'tree', pathMatch: 'full'
            ├── 'tree'     → MilestoneTreeTabComponent   (built this round)
            ├── 'board'    → ComingSoonTabComponent (title="Board")
            ├── 'backlog'  → ComingSoonTabComponent (title="Backlog")
            ├── 'my-task'  → ComingSoonTabComponent (title="My Task")
            └── 'list'     → ComingSoonTabComponent (title="List")
```

- Landing on bare `/work/:id` (no milestone in the URL): `ProjectDetailComponent` loads the milestone list, then `router.navigate(['milestones', firstMilestone.objectiveId, 'tree'], { relativeTo: this.route, replaceUrl: true })` — same auto-select-first-milestone behavior as today, now expressed as a navigation instead of a local signal.
- Clicking a different milestone card in the row always navigates to that milestone's `tree` sub-route (resets the active sub-tab to Tree, per the user's confirmed flow: "top-la select panna milestone-ku thaan sub-menu work pannum, Tree default").
- All 5 tab routes are lazy-loaded (`loadComponent`), consistent with `ARCHITECTURE.md` §3.1.

## Component architecture (per `docs/core/ARCHITECTURE.md` §2/§4, `PROCESS_RULES.md` rule 6)

Follows the existing `feature → ui → state → data-access` layering — no new pattern introduced.

| Component | Layer | Responsibility |
|---|---|---|
| `ProjectDetailComponent` | `feature/` (reworked) | Shell only now: project header card, milestone card row, `<router-outlet>` for the active tab. Owns milestone-list loading and the first-milestone auto-navigate. No longer owns subtree/detail state directly (moved to `MilestoneTreeTabComponent`). |
| `MilestoneSubMenuComponent` | `ui/` (new) | Presentational. Input: `milestoneTitle`. Renders the selected milestone's name as a small label above the tab row, then Tree/Board/Backlog/My Task/List as native `routerLink` + `routerLinkActive` links — no custom outputs needed since navigation *is* the interaction. |
| `MilestoneTreeNodeComponent` | `ui/` (reworked in place) | Explorer/folder style. Local `expanded = signal(true)` per node (root) / `signal(false)` (deeper levels) — **root expanded, children collapsed by default**, per approved mockup. Chevron click toggles `expanded` only. Row click emits `selected(node)` (new `output()`) — does not affect expand state. Connector lines (`::before`) use `var(--color-border)` at full opacity for visibility (mockup used a faint 0.35 rgba by mistake — corrected per user feedback: "connecting lines ellam clear ah irukkanum"). Selected node gets the existing `ring-[var(--color-focus-ring)]` highlight treatment used elsewhere in the module (`MilestoneCardComponent`, `ProjectCardComponent`). |
| `MilestoneDetailPanelComponent` | `ui/` (new) | Presentational card for panel 8. Inputs: `detail: ObjectiveDetail \| null`, `loading: boolean`, `error: string \| null`. Renders title, start/end date, progress %, allocated/completed hours, description, Achieved badge (`isAchieved`). No owner/reporting-manager fields — not available for arbitrary tree nodes from any existing endpoint (see API gap below). Four-state pattern (loading/error/empty-no-selection/data) per `ARCHITECTURE.md` §7.4. |
| `MilestoneTreeTabComponent` | `feature/` (new) | Reads `milestoneId` from `ActivatedRoute.paramMap` (parent route's own `:id` still resolved via `ActivatedRoute.parent`). Calls `store.loadMilestoneSubtree(milestoneId)` on init for the tree (7). On any node `selected` event, calls `store.loadNodeDetail(node.id)` for the panel (8). Renders `MilestoneTreeNodeComponent` (7, ~62% width) and `MilestoneDetailPanelComponent` (8, ~38% width) side by side, per approved mockup proportions. |
| `ComingSoonTabComponent` | `ui/` (new, shared) | Wraps the existing `app-empty-state` with a `title` input. One component reused by Board/Backlog/My Task/List route entries (each a thin lazy-loaded wrapper passing its own title) rather than four near-duplicate stub components. |
| `ProjectDetailStore` | `state/` | Add `nodeDetail: ObjectiveDetail \| null`, `nodeDetailLoading: boolean`, `nodeDetailError: string \| null` state + `loadNodeDetail(id)` method (calls existing `api.getObjectiveById`). Kept **separate** from `milestoneActionError`/the existing `getMilestoneDetail()` used by the settings modal, so the tree-panel fetch and the edit-modal fetch don't share error/loading state and can't stomp on each other if both are triggered close together. `selectedSubtree`/`subtreeLoading`/`subtreeError`/`loadMilestoneSubtree`/`clearSelectedSubtree` are reused as-is. |
| `ProjectApiService` | `data-access/` | **No changes.** `getMilestoneSubtree(objectiveId)` and `getObjectiveById(id)` already cover both panels. |

### Data flow for panel 8

`getMilestoneSubtree` (tree, panel 7) and `getObjectiveById` (detail, panel 8) are two independent calls — selecting a node does not re-fetch the tree, and loading the tree does not pre-fetch every node's detail. Only the clicked node's detail is fetched, on demand.

## Confirmed API gap (not blocking, explicitly out of scope this round)

`GET /work/objectives/{id}` (used for panel 8) returns `ownerId`/`reportingManagerId` but not resolved display names — those names exist only on the top-level "My Milestones" list response (`MyProjectMilestoneDto.ownerName`/`reportingManagerName`), not on arbitrary subtree nodes. Panel 8 will omit the Owner/Reporting Manager fields entirely for now. A backend addendum to resolve names on `GetObjective` would be a separate, future spec (mirroring the pattern already used once in `2026-08-10-milestone-ownership-and-subtree-access-design.md` in the backend repo) — not written now, since the user explicitly deferred it.

## Milestone card row → sub-menu interaction (confirmed flow)

1. Page loads → milestones fetched → first milestone auto-selected → navigates to `.../milestones/<first-id>/tree`.
2. Sub-menu shows the selected milestone's name + Tree (active) / Board / Backlog / My Task / List tabs.
3. Tree tab: root node (the selected milestone itself) renders expanded; clicking any node selects it (updates panel 8) independently of expanding/collapsing it.
4. Clicking a different milestone card in the row re-navigates to that milestone's Tree tab (sub-tab always resets to Tree on milestone change — Board/Backlog/etc. state, once built, will not carry over between milestones).

## Cross-cutting fix: back-navigation scroll position

`app.config.ts` currently has no `withInMemoryScrolling`, so Project List's scroll/filter position is not restored when navigating back from Project Detail (filters *do* persist today, since `ProjectListStore` is `providedIn: 'root'` and outlives the component — only scroll position is the gap). Fix: add `withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })` to the existing `provideRouter(routes, ...)` call. One line, app-root-level, touches no other module's code — included in this plan per user confirmation.

## Styling (per `docs/design/*`)

- Tree connector lines: `var(--color-border)` (not a faint custom rgba) for clear visibility, per explicit user feedback on the mockup.
- Selected states (tree node, milestone card — already existing pattern): `var(--color-focus-ring)` ring, matches `MilestoneCardComponent`/`ProjectCardComponent`.
- Cards/panels: `app-card` where applicable, `12px` (`--radius-content`) corners, existing `--color-surface`/`--color-border` tokens — no new colors introduced.
- Icons (chevron): inline SVG per `ICON_THEME_SYSTEM.md` (`stroke="currentColor"`, `viewBox 0 0 24 24`, rotate transition on expand/collapse), not a text glyph — the mockup used `▾`/`▸` as a placeholder only.
- No `.ts` logic/store/routing changes are "styling-only" — this is a structural change, so `COMPONENT_DESIGN_RULES.md`'s styling-only boundary does not apply to this spec; it applies to future *pure visual polish* passes on top of what's built here.

## Error handling

Standard module error taxonomy (`ARCHITECTURE.md` §7) for all four states (loading/error/empty/data) on both the tree fetch and the node-detail fetch, matching existing `MilestonesLoading`/`Error`/empty-state conventions elsewhere in this component.

## Out of scope

- Actual Board/Backlog/My Task/List functionality — stub pages only.
- Owner/Reporting-Manager name resolution for tree nodes — deferred backend addendum, not written this round.
- Any change to `MilestoneSettingsModalComponent`, `MilestoneCardComponent`'s own click/selected behavior, Achieve/Edit flows, or `ProjectListComponent`/`ProjectCardComponent` beyond the one-line scroll-restoration fix in `app.config.ts`.
- Lazy per-node API fetching for tree expand/collapse — the existing `getMilestoneSubtree` already returns the full nested subtree in one call; expand/collapse is client-side UI state only, no new network calls per node.

## Testing

Standard TDD per component/store (Vitest + Angular TestBed), matching existing conventions:
- `MilestoneTreeNodeComponent`: chevron click toggles expand without emitting `selected`; row click emits `selected` without toggling expand; root defaults expanded, children default collapsed.
- `MilestoneDetailPanelComponent`: renders all four states; omits owner/reporting-manager fields.
- `MilestoneTreeTabComponent`: reads `milestoneId` from route; loads subtree on init; loads node detail on `selected` event; re-navigating with a different `milestoneId` reloads both.
- `MilestoneSubMenuComponent`: renders milestone title; active tab gets `routerLinkActive` styling.
- `ComingSoonTabComponent`: renders `app-empty-state` with the given title.
- `ProjectDetailComponent`: no milestone in URL → navigates to first milestone's `tree` route with `replaceUrl: true`; milestone card click navigates to that milestone's `tree` route.
- `work.routes.spec.ts`: extend for the new nested `milestones/:milestoneId/(tree|board|backlog|my-task|list)` routes and the `''` redirect.
- Router config: `app.config.spec.ts`-level or smoke check that `withInMemoryScrolling` is registered (or manual verification if no existing test covers `app.config.ts`).
