# Project Detail — Compact Cards, Horizontal Scroll, Inline Milestone Detail Design

**Status:** Approved 2026-08-10 (brainstormed same day, with a visual mockup the user approved with one change — no View button, whole card clickable). No plan written yet.

## Problem

Per user's manager: milestones need a "detail view." That already exists today as a separate route (`/work/:projectId/milestones/:objectiveId`, `MilestoneDetailComponent`, built earlier this session). But the user now wants that detail to render **inline on the Project Detail page** instead of navigating away — confirmed via an approved mockup. This also folds in two layout requests: make the project header a proper (short) card, and make the Milestones section a horizontal-scrolling row of shorter cards instead of a wrapping grid.

## Changes

### 1. Project header becomes a compact card

Currently a plain `<dl>` grid with no card chrome. Wrap it in `app-card` (existing shared component), laid out as one compact row (name/identifier left, start/target/hours right) instead of the current 2-row `<dl>` grid — matches the mockup's red-boxed header redesign.

### 2. `MilestoneCardComponent` — no View button, whole card clickable, shorter

- Remove the "View" button entirely. The card's root element gets `(click)="viewed.emit()"` — clicking anywhere on the card selects it.
- The existing ⚙ Settings button (owner-only) must call `event.stopPropagation()` in its click handler, so clicking it doesn't also fire the card's `viewed` selection.
- New `selected = input(false)` — when true, renders a visible highlight ring (matches the mockup's blue outline on the active card), so the user can see which milestone's detail is currently showing below.
- Drop the Start/End date row from the card face to shorten it (title, owner, hours, Achieved badge only) — dates are still visible in the detail panel once selected. This is the "short card" the user asked for.

### 3. Milestones section — horizontal scroll, not a wrapping grid

Replace the current `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` wrapper with a horizontally-scrolling flex row (`flex gap-4 overflow-x-auto`), each card `flex-shrink-0` with a fixed min-width (~200px, per the mockup).

### 4. Inline detail panel below the row — reuses existing store state, no new store methods

`ProjectDetailStore` already has `loadMilestoneSubtree`, `selectedSubtree`, `subtreeLoading`, `subtreeError`, `clearSelectedSubtree` — built for exactly this inline pattern in the module's original (pre-route) design, still present and untouched, just unused since the dedicated route replaced it. Reviving it:

- `onMilestoneSelected(milestone)` (replaces `onMilestoneViewed`) — no more `router.navigate`; instead sets a new local `selectedMilestoneId` signal and calls `store.loadMilestoneSubtree(milestone.objectiveId)`.
- Below the horizontal card row: a section rendering, in order — loading (`subtreeLoading()`), error (`subtreeError()`, retryable), a "select a milestone" empty-state prompt when nothing is selected yet, or the tree (`MilestoneTreeNodeComponent`, unmodified) once `selectedSubtree()` resolves. Same four-state pattern as everywhere else in this module.
- `ngOnInit` must reset `selectedMilestoneId` to null and call `store.clearSelectedSubtree()` before loading the new project's data — otherwise navigating from one project's detail page to another's would briefly show the previous project's selected milestone tree. (Found while writing this spec — not present in the old routed version because a fresh route always meant a fresh component instance; an inline panel on the same component does not get that reset for free.)

### 5. Remove the now-unused standalone route

Per user confirmation: the separate `/work/:projectId/milestones/:objectiveId` route is no longer needed once detail is inline. Delete `MilestoneDetailComponent` (`feature/milestone-detail/*`, all 3 files) and its route entry in `work.routes.ts`.

## Out of scope

- No change to `MilestoneSettingsModalComponent`, the Settings gear button's behavior, or Achieve/Edit flows — only the View/select interaction and layout change.
- No change to `ProjectCardComponent`/`ProjectListComponent` (that's the Project List page, not Project Detail) — this spec is Project Detail only.

## Testing

Standard TDD per component (Vitest + Angular TestBed), matching existing conventions:
- `MilestoneCardComponent`: card click emits `viewed`; Settings click does not also emit `viewed` (stopPropagation); `selected` input renders the highlight class; Start/End fields no longer render.
- `ProjectDetailComponent`: clicking a milestone card calls `loadMilestoneSubtree` with the right id and renders the tree once `selectedSubtree()` resolves; switching to a different card's click updates `selectedMilestoneId` and reloads; `ngOnInit` clears stale subtree state before loading.
