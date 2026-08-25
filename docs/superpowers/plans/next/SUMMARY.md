# plans/next/ — Summary

Pending plans and raw not-yet-brainstormed future-feature context. Stays flat — no date subfolders (see `../../rules/FILE_CREATION_RULES.md`).

- `2026-08-25-work-management-task-time-tracking-and-my-task/` — status: pending, not started. 6 parts:
  Part 1 converts `my-task` to a project-level route and removes the standalone `list` stub tab, Part 2
  data-access layer additions, Part 3 shared `TaskClockWidgetComponent`, Part 4 history feed +
  `TaskDetailModalComponent` percent/reason editing, Part 5 the routed `MyTaskComponent` (Board/List
  toggle, Sprint filter, search), Part 6 wires the clock widget into Board/Backlog/My Task cards and rows,
  flips the route to the real component. Design:
  `../../specs/next/2026-08-25-work-management-task-time-tracking-and-my-task-design.md`. Companion:
  backend repo's same-named plan folder (9 parts, including a Part 9 added after a gap found mid-plan).
  Combined execution/code-review prompts at `Desktop/build/`.
- `Project Management.md` — raw context captured 2026-08-04 from a corrections document (Project Page, Create Project, Edit Project, Overdue/Close popup, Delete confirmation). Status: **not started**, no code exists for it yet, not yet brainstormed or spec'd. Moved here from the former `docs/superpowers/next-plan/` folder on 2026-08-06 to match the backend repo's `plans/next/` convention.
- `2026-08-11-project-detail-milestone-tree-explorer/` — status: **superseded by `2026-08-12-milestone-tree-mockup-redesign.md` below**, not implemented. 3 parts (`part-1-sub-menu-and-stub-tabs.md`, `part-2-explorer-tree-and-detail-panel.md`, `part-3-routing-integration.md`), split per `FILE_CREATION_RULES.md` rule 3. Design doc: `../../specs/next/2026-08-11-project-detail-milestone-tree-explorer-design.md` (also marked superseded).
- `2026-08-12-milestone-to-module-display-rename.md` — status: pending, not started. 5 tasks: 4 one-file display-string edits (project-detail loading/empty states, milestone-card aria-label, milestone-settings-modal title/help text, project-detail.store error message) plus a final regression-check task. Design doc: `../../specs/next/2026-08-12-milestone-to-module-display-rename-design.md`. Companion to the backend repo's same-named plan. Note: while working `2026-08-12-milestone-tree-mockup-redesign.md`, the milestone-settings-modal and project-detail.store edits were found already present in the working tree/live code — only the project-detail card-grid strings were still pending, and those strings are removed entirely (not renamed) by the mockup redesign since the card grid itself goes away.
- `2026-08-12-milestone-tree-mockup-redesign.md` — status: pending, not started. 8 tasks: DTOs, `ProjectApiService`, `MilestoneTreeNode` model/mapper, `ProjectDetailStore`, `MilestoneTreeNodeComponent`, `MilestoneDetailPanelComponent`, new `CreateSubModuleModalComponent`, `ProjectDetailComponent` + routes (deletes `milestone-tree-tab`). Design doc: `../../specs/next/2026-08-12-milestone-tree-mockup-redesign-design.md`. **Depends on** the backend repo's `2026-08-12-objective-viewmodel-owner-fields-fix.md` landing first — see that plan's Global Constraints.
- `2026-08-16-work-management-task-foundation/` — status: implemented (Parts 1–2 on `Project-management-09-08-2026`; Part 1 through `df4782d`, Part 2 through `7dfffeb`). Keep in `next/` until a finishing pass moves the companion backend + frontend folders together. Design: `../../specs/next/2026-08-16-work-management-task-foundation-design.md`.
- `2026-08-20-work-management-project-page-redesign/` moved to `plans/finished/2026-08-21/` on 2026-08-21 — all 3 parts shipped (394/394 Work module tests), user completed full manual browser test 2026-08-21 ("perfect, OK"). See `plans/SUMMARY.md`.
- `2026-08-20-work-management-tree-sprint-task-unified-view/` — status: all 7 parts shipped and
  test-green (443/443 Work module tests) as of 2026-08-21 — `part-1-node-model-and-sprint-task-nesting.md`
  (kind discriminator, lazy Sprint/Task fetch), `part-2-row-action-icons.md` (shared create/edit/members
  icon set), `part-3-remove-old-layout.md` (removed Modules carousel + `MilestoneDetailPanelComponent`),
  `part-4-project-wide-tree-data-source.md` (project-wide tree fetch + Module filter dropdown, needed
  backend Part 3), `part-5-module-sprint-task-row-components.md` (3 separate row components, isOwner-gated
  icons), `part-6-restore-explanation-panel.md` (restored side panel, **reversing Part 3's removal**),
  `part-7-delete-task-and-sprint-optional-create.md` (real delete-task call, sprint-optional create from a
  Module row — needed backend Parts 4-5). Design:
  `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
  §4. Backend counterpart's Parts 1-6 also all shipped (428/428 WorkManagement tests). Code-complete both
  repos — **still pending the manual browser pass** before this moves to `finished/`: green tests alone
  aren't enough, per this session's own experience on the Project Page Redesign work.
- `2026-08-21-work-management-project-scoped-task-status-and-category/` — status: pending, not started.
  2 parts. Design: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-work-management-project-scoped-task-status-and-category-design.md`.
  `part-1-project-settings-page-and-task-status-tab.md` — new `work/:id/settings` route
  (`ProjectSettingsComponent`), moves Task Status editing off the per-Module `settings` tab onto this new
  Project-level page, re-points `BoardStructureEditorComponent`/`TaskApiService` at the Project-scoped
  API (needs the backend companion plan's Part 1 shipped first). `part-2-task-category-tab.md` — new
  Task Category tab, net-new `CategoryListEditorComponent` (simplified drag-reorder, no
  visibility/marksTaskComplete fields), needs backend companion Part 4 shipped first. Both parts also
  need this same plan's Part 1 (the `ProjectSettingsComponent` shell) done before Part 2.
- `2026-08-21-work-management-tree-ui-bug-fixes.md` — status: pending, not started. Single-file bounded
  plan (no design doc, per `superpowers:brainstorming`'s bounded path). 4 items: Sprint-creation
  verification (no code change, folds into the tree/sprint/task unified view manual pass), missing Task
  delete icon (traced — not a separate bug, resolves once the backend's cascading-ownership plan ships),
  status text/icon overlap (root cause not yet confirmed, needs repro first), Module filter missing an
  Active/Inactive/All dimension (confirmed real gap in `collectObjectiveOptions` — no code reads
  `isActive` at all today).
