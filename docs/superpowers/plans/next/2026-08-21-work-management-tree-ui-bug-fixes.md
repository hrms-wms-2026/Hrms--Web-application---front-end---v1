# Work Management — Tree UI bug-fix bucket

**Status:** pending, not started. Bounded fixes, no design doc needed per `superpowers:brainstorming`'s
bounded path — see the chat brainstorm on 2026-08-21 for the original 4 items raised.

**Scope guard:** Work Management module only: `src/app/modules/work/**`.

## Item 1: Sprint creation flow — verification only, no code change expected

The user asked to re-check Sprint creation across the tree. Per the backend + frontend companion plans
already shipped this session (`2026-08-20-work-management-tree-sprint-task-unified-view`, both repos,
428/428 + 443/443 tests green), Sprint creation — with or without a Sprint under a Module directly — is
already implemented and covered by tests. This item is **not a code task**, it's part of the manual
browser pass already pending for that feature (see that plan's own Part 5/Part 7 "Definition of done").
Do not write new code for this item; verify it during that manual pass instead.

## Item 2: Task delete icon "missing" — not a separate bug, resolves via the cascading-ownership plan

Traced to `TaskTreeRowComponent` (`src/app/modules/work/ui/task-tree-row/task-tree-row.component.ts:51`):
```typescript
@if (node().isOwner) {
  <button ... data-testid="delete-task-button" aria-label="Delete task" ...>
```
The delete icon is correctly gated on `isOwner` — that's the documented design (Task rows: Edit stays
ungated, only Delete is gated, per the tree/sprint/task unified view design's Part 5). A Task node's
`isOwner` is set in `project.mapper.ts` as `isOwner: parent.isOwner` (inherited straight from its
Sprint/Module parent, confirmed by reading `toMilestoneTreeSprintNode`/`toMilestoneTreeTaskNode` in that
file) — the frontend is behaving exactly as designed.

The actual cause: today's backend only sets a Module's `isOwner` true for the **exact** Objective a
caller directly owns/is-a-member-of, not for its descendants (see
`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-work-management-cascading-objective-ownership-design.md`).
So a Task under a Module you manage *through* a parent (not the exact node) currently gets
`isOwner: false` all the way down, hiding its delete icon. **No frontend code change needed for this
item** — it resolves automatically once the backend `HRMS-Backend-v1` repo's
`2026-08-21-work-management-cascading-objective-ownership` plan (all 5 parts) ships, because the tree's
`IsOwner` flag will then cascade correctly. Verify this specific case (delete icon appears on a Task two
levels below a Module you're a plain member of, not owner) as part of that plan's own manual browser
pass — don't duplicate the check here.

## Item 3: Status text/icon overlap — needs a fix, root cause not yet confirmed

Not traced to a specific line during this session's brainstorm — investigate before fixing. Candidates,
in order of likelihood based on the row components read so far:
- `ModuleTreeRowComponent`/`SprintTreeRowComponent`/`TaskTreeRowComponent` — each row's leading cell
  packs an icon, a title, and (for Task rows) a status badge into one flex container with `min-w-0` and
  `truncate` on the title (see `task-tree-row.component.ts:15-24` for the exact current markup shape).
  On a narrow viewport or a long title, `truncate` on the title span may not leave the status badge
  enough room, causing the two to visually collide instead of the title truncating first. Reproduce at a
  few viewport widths (browser resize, not just default desktop) before concluding this is the cause.
- Check the same cell shape in `ModuleTreeRowComponent`/`SprintTreeRowComponent` for the same pattern —
  if the overlap reproduces on all three row kinds, the fix belongs in a shared pattern; if it only
  reproduces on one, fix that row's markup specifically rather than changing all three.

Task: reproduce first (screenshot or precise repro steps — which row kind, what title length, what
viewport width), identify the actual CSS cause, then fix with a `min-w-0` + `shrink-0` combination that
lets the title truncate before the badge is squeezed (the badge already has `shrink-0` per the code read
above — if the title span doesn't also have both `min-w-0` and `truncate` correctly applied within a
`flex` ancestor that itself has `min-w-0`, that's the classic Tailwind flex-truncation bug and the most
likely actual cause). Add or update a component test asserting the status badge renders with correct
`data-testid="status-badge"` content and the title truncates via CSS class presence (not pixel-precise
visual assertion — this project's existing tests don't do visual regression, follow that convention).

## Item 4: Module filter — add an Active/Inactive/All dimension

Confirmed real gap (not a wiring bug — the feature genuinely doesn't exist yet):
`collectObjectiveOptions` (`src/app/modules/work/utils/project.mapper.ts:86-96`) walks the whole tree and
lists every Objective-kind node by `{ id, title }` — it does not read `isActive`/`isAchieved` at all, so
an achieved/inactive Module appears in the dropdown exactly like an active one, and there is currently no
way to hide it. `ModuleFilterSelectComponent` (full content already read) has exactly one `<select>` —
the module picker — no second control for activity state.

**Files to modify:**
- `src/app/modules/work/utils/project.mapper.ts` — `collectObjectiveOptions` return type gains
  `isActive: boolean` (or `isAchieved`, whichever field `MilestoneTreeNode` already carries for this —
  check `milestone.model.ts`'s `MilestoneTreeNode` interface first, both `isActive` and `isAchieved`
  showed up in earlier greps, confirm which one the user means by "Active/Inactive" before picking — the
  design intent from the chat was module-active-state, most likely `isActive` given the Sprint-status
  precedent elsewhere in this tree uses `isActive`/`isAchieved` as genuinely distinct concepts, don't
  conflate them without checking).
- `src/app/modules/work/ui/module-filter-select/module-filter-select.component.ts` — add a second
  `<select>` (or a 3-way toggle, matching whatever control style this codebase already uses for a
  similar tri-state filter elsewhere — check for a precedent before inventing a new UI pattern) offering
  Active / Inactive / All, defaulting to **All** (don't silently hide inactive modules by default — that
  would be a behavior change no one asked for, the ask was to make filtering *possible*, not to change
  the default view). Emits a second output alongside the existing `selectionChanged`.
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` — add a second signal
  (`selectedActivityFilter`, default `'all'`), thread it into `moduleFilterOptions` (filter the list by
  the chosen state before rendering options) and/or `renderedTree` (if "Inactive" should also prune the
  rendered tree itself, not just the dropdown's option list — confirm this with the user's original
  intent: "atha vachu than filter pannanum" reads as filtering the module list *by* activity state, most
  likely meaning both the option list and which modules the tree shows).

**Tests:** add cases to `milestone-tree-tab.component.spec.ts` and
`module-filter-select.component.spec.ts` covering: an inactive Module is excluded from the option list
when "Active" is selected, included when "Inactive" or "All" is selected; selecting "Inactive" prunes the
rendered tree to only inactive modules (if that's the confirmed behavior per the note above).

## Definition of done

- Item 1: no code change, folded into the existing manual-pass checklist.
- Item 2: no code change, folded into the cascading-ownership plan's manual pass.
- Item 3: root cause identified and fixed, with a regression test.
- Item 4: Active/Inactive/All filtering implemented and tested, defaulting to "All" (no behavior change
  for existing users until they actively pick a narrower filter).
- `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` green.
