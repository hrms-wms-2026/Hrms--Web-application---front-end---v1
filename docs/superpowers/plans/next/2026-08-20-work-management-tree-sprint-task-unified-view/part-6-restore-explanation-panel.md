# Part 6: Restore the side Explanation panel, restyled to match the Project List page's card

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (rewritten 2026-08-21).

**Scope guard:** Work Management module only (`src/app/modules/work/**`).

**Depends on:** `part-5-module-sprint-task-row-components.md` (needs `node().kind` to pick which detail
shape to render) but is otherwise independent — can ship before or after Part 7.

**Reverses:** `part-3-remove-old-layout.md` (shipped 2026-08-21) — that part deleted
`MilestoneDetailPanelComponent` on the reasoning that row icons fully covered its actions. The user
explicitly reversed this after seeing it: row icons cover *actions*, but a glanceable detail view when
selecting any row is still wanted, restyled to match the Explanation Card already shipped on the Project
List page.

**Status:** not started

## Goal

Selecting any tree row (Module, Sprint, or Task — all 3 kinds, not just Module) shows a side panel with that
node's full detail, styled like `ProjectExplanationCardComponent`
(`src/app/modules/work/ui/project-explanation-card/project-explanation-card.component.ts`): a `CardComponent`
wrapper, Tailwind utility classes inline (no external `.scss`/`styles: []` array — match the existing
convention exactly), a title/subtitle header, a key-value detail list, and a stack of full-width action
buttons.

## Current state

`MilestoneTreeTabComponent` already tracks `selectedNodeId` (local signal) and has a `selectedNode`
`computed()` resolving it against `store.selectedSubtree()` via `findTreeNode` — this selection-tracking
plumbing is intact and unused for anything but row highlighting today (see Part 4's Explore findings). No
panel currently renders from it.

`ProjectExplanationCardComponent` is scoped to a `Project` input — it cannot be reused as-is for a
`MilestoneTreeNode`, it needs a sibling component with the same visual language but a different input shape
and per-`kind` content.

## Files to create

- `src/app/modules/work/ui/tree-explanation-panel/tree-explanation-panel.component.ts` (+ `.spec.ts`)

## Files to modify

- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` (+ `.html`, `.spec.ts`)
  — render `<app-tree-explanation-panel>` alongside the tree (side-by-side layout, e.g. tree in a
  `flex-1` column, panel in a fixed-width sidebar column — check `ProjectExplanationCardComponent`'s
  container width/breakpoint choices on the Project List page and match them for visual consistency) when
  `selectedNode()` is non-null; some empty/placeholder state when nothing is selected (don't just render
  nothing — an empty bordered card with a hint like "Select a module, sprint, or task to see its details"
  is consistent with this codebase's existing `EmptyStateComponent` usage elsewhere).

## Component design

`TreeExplanationPanelComponent` takes `node = input.required<MilestoneTreeNode>()` and outputs mirroring
what the row icons already emit for that node's kind (reuse the SAME output names as the row components —
`editRequested`, `membersRequested`, `achieveRequested`, `createSprintRequested`, `createTaskRequested`,
`achieveSprintRequested`, `completeSprintRequested`, `deleteRequested` — so `MilestoneTreeTabComponent`'s
existing handlers from Part 5 can be reused unchanged, just bound to a second emitter). Content switches on
`node().kind`:

- **`objective`**: title, description, owner (via `EmployeeAvatarComponent`, matching
  `ProjectExplanationCardComponent`'s owner row), start/target dates, allocated/completed/progress KPI grid
  (reuse the exact 3-box layout and `hoursProgress()`-style computation from `ProjectExplanationCardComponent`
  rather than inventing a new one), achieved badge if `isAchieved`. Action buttons: same set as the Module
  row's 6 icons, rendered as labeled buttons instead of icons (mirrors how `ProjectExplanationCardComponent`
  turns the Project List row's icon actions into full buttons) — gated by the same row-level `isOwner` rule
  from Part 5.
- **`sprint`**: title, status badge, completion bar (reuse Part 5's sprint completion bar component/logic,
  don't reimplement), owner. Action buttons: Create task, Edit Sprint, Achieve Sprint, Complete Sprint —
  same `isOwner` gate.
- **`task`**: title, assignee, status badge, description if present. Action buttons: Edit task (ungated),
  Delete task (`isOwner`-gated, still stubbed per Part 5 until backend Part 4 + Part 7 land).

## Tasks (small, do in order, one commit per task)

1. `TreeExplanationPanelComponent` skeleton + objective-kind content + its action buttons, with a spec
   covering: renders correct fields for an objective node, action buttons hidden when `!isOwner`.
2. Sprint-kind content + action buttons, spec coverage matching pattern above.
3. Task-kind content (including assignee — reuse whatever Part 5 task 3 established for reading assignee
   off `node().taskSource`) + action buttons, spec coverage.
4. Wire into `MilestoneTreeTabComponent`: side-by-side layout, empty-state when nothing selected, all
   output handlers bound to the same Part 5 handlers. Update `MilestoneTreeTabComponent`'s own spec — it
   previously asserted `app-milestone-detail-panel` is absent (that assertion is now WRONG and must be
   replaced with an assertion that `app-tree-explanation-panel` IS present once a node is selected).

## Definition of done

- All 4 tasks committed individually.
- `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` fully green.
- Manual check (dev server): select each of a Module, a Sprint, and a Task row in turn, confirm the panel
  updates correctly for each kind and its buttons match the row's own icon set exactly (no drift between
  what the row offers and what the panel offers for the same node).
