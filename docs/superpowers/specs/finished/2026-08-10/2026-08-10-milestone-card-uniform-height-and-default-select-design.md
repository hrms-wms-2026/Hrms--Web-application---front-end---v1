# Milestone Card Uniform Height + Default-Selected First Milestone Design

**Status:** Approved 2026-08-10 (brainstormed same day, short — root cause diagnosed and confirmed with the user before writing this doc). No plan written yet.

## Problem

1. Milestone cards in the horizontal-scroll row already have equal width (`w-48` on each wrapper) but not equal height — nothing in the `app-milestone-card` → `app-card` → `<section>` chain propagates the flex row's natural stretch height down into the visible bordered box, so cards with different content (owner name length, Achieved badge present/absent) render at different heights.
2. The inline detail panel below the row is empty until the user clicks a card. User wants the first milestone auto-selected on load so the panel isn't empty by default.

## Changes

### 1. Uniform card height via host-level stretch, not a fixed pixel height

- `CardComponent` (`shared/ui/card/card.component.ts`): add `host: { class: 'block h-full' }` to `@Component`, and its `<section>` template gains `h-full flex flex-col` — the section fills whatever height its host now claims.
- `MilestoneCardComponent`: add `host: { class: 'block h-full' }` too, and its root wrapping `<div>` gains `h-full`.
- No change needed in `project-detail.component.html`'s row wrapper (`<div class="w-48 flex-shrink-0">`) — a flex row's direct children already stretch to the tallest sibling by default (`align-items: stretch`); the fix is making every custom-element level *inside* that wrapper actually claim that available height instead of defaulting to inline/content-sized.
- Deliberately not a fixed pixel height — the row's height still grows/shrinks with whichever milestone has the most content; every card in the row just matches whichever is tallest.

### 2. First milestone default-selected

`ProjectDetailComponent.ngOnInit` awaits `loadMyMilestones`, then if `store.milestones()` is non-empty and nothing is already selected, calls `onMilestoneSelected(milestones[0])` — the exact same code path a click already uses, so the detail panel is populated immediately instead of showing the "Select a milestone" prompt on first load.

## Out of scope

- `ProjectCardComponent`/`ProjectListComponent` — not touched. That page uses a CSS grid, not a horizontal-scroll row, and wasn't part of this ask. (Worth noting for later: it likely has the same underlying height-mismatch cause, since `CardComponent` is shared — but grid layouts read as "aligned" less obviously than a scroll row, and the user didn't ask about it.)
- No fixed/pixel card height — see above.

## Testing

- `CardComponent`/`MilestoneCardComponent`: no dedicated height-in-pixels test (jsdom doesn't lay out flexbox reliably) — verify via class presence (`h-full` on host, `h-full flex flex-col` on the section) rather than measured height.
- `ProjectDetailComponent`: after milestones load, `selectedMilestoneId()` equals the first milestone's id and `loadMilestoneSubtree` was called with it, without any click.
