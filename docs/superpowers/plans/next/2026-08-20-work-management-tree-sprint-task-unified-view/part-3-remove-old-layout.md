# Part 3: Remove the old Modules carousel + side detail panel

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4. **Depends on Part 2 being done** — row icons must already cover every action the old side detail
panel provided (edit, achieve/unachieve, create-sub, members) before removing it, so nothing is lost
mid-feature. Do not do this part first.

**Scope guard:** Work Management module only. This part touches `ProjectDetailComponent`, which is a
shared parent for the Board/Backlog/List/Approvals/My Task/Calendar/Settings tabs too (confirmed with the
user: those tabs stay exactly as they are) — be careful this part only removes the Modules carousel and
the always-conditional-submenu wrapper, not anything those other tabs depend on.

**Status:** shipped 2026-08-21 (commits `15a1b32`, `efcfe84`, `d946e85`, `076321e`) — Modules carousel,
`MilestoneCardComponent`, the side detail panel, and `MilestoneDetailPanelComponent` are all deleted from
the working tree exactly as this part describes.

**⚠️ SUPERSEDED:** the decision this part implemented — "row icons fully replace the side panel, so delete
it" — has been REVERSED by the user after this shipped. A restyled explanation/detail side panel is coming
back; see `part-6-restore-explanation-panel.md`. This file is kept as a historical record of what shipped
and why (the row-icon coverage reasoning in "Goal" below was correct at the time), not as a description of
the current or intended UI. Do not use this file to justify keeping the panel removed.

## Goal

Per the user's explicit, twice-confirmed instruction — "old UI total-ah remove pannanum... sub menu and
tree mattum thane show aganum" (only the submenu and the tree should show) — remove:
1. The "Modules" horizontal card carousel from `ProjectDetailComponent` (project header + Modules cards +
   conditional submenu/outlet → project header + submenu/outlet, unconditional once a milestone resolves).
2. The `app-milestone-detail-panel` side panel from `MilestoneTreeTabComponent` (tree becomes full width).

## Files to modify

- `src/app/modules/work/feature/project-detail/project-detail.component.html`/`.ts` — remove the Modules
  carousel block (`<h2>Modules</h2>` through the `@for` card loop); the `activeMilestoneId()`-guarded
  submenu+outlet block's condition can likely simplify since `ngOnInit` already auto-redirects when no
  milestone is selected — confirm whether the `@if (activeMilestoneId(); as milestoneId)` guard is still
  needed at all once there's no card list offering an alternative unselected state, or whether it should
  just always render submenu+outlet (falling back to a loader while the auto-redirect is in flight).
- `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html`/`.ts` — remove the
  two-column layout and the `app-milestone-detail-panel` element; the tree's container becomes full width
  (`w-full` instead of `md:w-[72%]`). Remove now-unused `selectedNode`/panel-specific wiring **only if**
  Part 2 already moved every consumer of `selectedNode` onto the row-level flow — check each usage
  (`onEditRequested`, `onAchieveToggleRequested`, `onMembersRequested`, etc.) individually; some of this
  logic is reused by Part 2's row-icon handlers and must stay, just re-triggered from row events instead
  of the panel.
- `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`(+`.html`/`.spec.ts`
  if separate files) — **delete**, confirmed zero other consumers in the codebase (verified this session
  via `grep -rl "app-milestone-detail-panel\|MilestoneDetailPanelComponent"` — only `milestone-tree-tab`
  referenced it). Re-verify this is still true before deleting (re-run the grep — code moves fast in this
  repo) rather than trusting this plan's snapshot.
- `src/app/modules/work/ui/milestone-card/milestone-card.component.ts` (+`.html`/`.spec.ts`) — **check**
  whether this becomes orphaned once the Modules carousel is removed (it was the carousel's card renderer)
  — if `grep` shows zero other consumers after this part's changes, delete it too; if something else still
  uses it, leave it.
- `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`,
  `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts` — remove tests
  that assert the deleted UI exists; keep/adapt tests for what remains.

## Before writing code

Re-run the "who else uses this" checks live rather than trusting the plan's snapshot — this session
already saw stale-plan mismatches cost time earlier (`feedback_hrms_docs_lag_git`-style risk applies to
frontend plans too, not just backend). Specifically confirm:
1. `MilestoneDetailPanelComponent` has no consumers outside `milestone-tree-tab`.
2. `MilestoneCardComponent` has no consumers outside the Modules carousel being removed here.
3. Every action the old detail panel offered (edit, achieve/unachieve, create-sub, members) has a live
   row-icon equivalent from Part 2 before you delete the panel — if you find one that's missing, stop and
   flag it rather than silently dropping functionality.

## Tasks (small, do in order, one commit per task)

1. **Remove the Modules carousel** from `project-detail.component.html`, and simplify
   `project-detail.component.ts`/`.html`'s milestone-selection guard per the investigation above (either
   drop the `@if (activeMilestoneId(); ...)` guard entirely in favor of a loader-while-redirecting state,
   or keep a minimal guard — whichever produces the cleanest "submenu+tree only" result matching the
   user's request). `MilestoneCardComponent`'s `viewed`/`settingsRequested` outputs and the
   `onMilestoneSelected`/`onMilestoneSettingsRequested` handlers tied only to the carousel go with it.
   - Test: `ProjectDetailComponent`'s spec no longer asserts Modules-carousel markup exists; asserts the
     submenu+outlet render once a project/milestone resolves.

2. **Delete `MilestoneCardComponent`** if Task 0's "before writing code" check confirms it's now orphaned
   (files + its spec). Skip this task with a note in the commit message if something unexpected still
   references it.

3. **Remove the side panel from the Tree tab**: delete the `app-milestone-detail-panel` element from
   `milestone-tree-tab.component.html`, widen the tree container to full width, remove the now-dead
   `MilestoneDetailPanelComponent` import. Keep every handler method Part 2's row icons still call
   (`onEditRequested`, `onAchieveToggleRequested`, `onMembersRequested`, `onSettingsSaved`,
   `onAddMemberRequested`, etc.) — only remove what was purely panel-rendering wiring with no Part-2
   caller left.
   - Test: Tree tab spec no longer asserts the panel exists; asserts the tree renders full width and that
     an action (e.g. clicking the leaf Objective's edit icon from Part 2) still opens the settings modal
     end to end.

4. **Delete `MilestoneDetailPanelComponent`** (component + template + spec files), confirmed orphaned by
   Task 0's re-verified check.

## Data flow

No new data flow — this part is pure removal + widening, once Part 2 has already given every row an
equivalent action. `ProjectDetailComponent`'s existing `ngOnInit` auto-redirect-to-first-milestone logic
is unchanged and now effectively becomes the page's only "landing" behavior (no carousel to land on
first).

## Non-functional

Don't touch Board/Backlog/List/Approvals/My Task/Calendar/Settings tab components — they're siblings
under the same `ProjectDetailComponent` parent and are explicitly out of scope (confirmed with the user:
"keep all, just add the new Tree depth alongside them").

## Definition of done

- All 4 tasks committed individually (Task 2 may be a no-op commit-message note if `MilestoneCardComponent`
  turns out not to be orphaned — don't force a deletion that isn't actually safe).
- Full frontend `work` module test suite green.
- No dead imports/files left behind — a repo-wide grep for `MilestoneDetailPanelComponent` and (if
  deleted) `MilestoneCardComponent` returns zero hits outside their own now-deleted files.
- This is the last part of this feature — once green, this whole
  `2026-08-20-work-management-tree-sprint-task-unified-view/` folder (this repo) and its backend
  counterpart both move to `finished/<date>/` in their respective repos, and a full manual browser pass
  (expand a leaf Objective → see Sprints/direct Tasks → expand a Sprint → see Tasks → try each row's
  icons) happens before calling this feature actually done — the same lesson this session already
  learned the hard way on the Project Page Redesign work: green tests are necessary, not sufficient.
