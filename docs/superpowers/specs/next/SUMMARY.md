# specs/next/ — Summary

- `2026-08-10-project-identifier-autosuggest-design.md` — status: approved 2026-08-10, no plan written yet. Auto-derives the Create Project form's Identifier field from the Name field (first word + 8-digit random suffix), stops once the user manually edits Identifier.
- `2026-08-11-project-detail-milestone-tree-explorer-design.md` — status: approved 2026-08-11 (visual mockup), no plan written yet. Adds a milestone sub-menu (Tree/Board/Backlog/My Task/List, nested routes under `/work/:id/milestones/:milestoneId`), reworks the milestone tree into an explorer/folder style (expand/collapse, root expanded/children collapsed by default) with a side-by-side detail panel fetched via the existing `getObjectiveById`, stub pages for the other 4 tabs, and a 1-line `app.config.ts` scroll-restoration fix. Reconciles with — does not reverse — the 2026-08-10 decision to remove the standalone milestone route (see the design doc's "Prior-decision reconciliation" section).
- `2026-08-12-milestone-to-module-display-rename-design.md` — status: approved 2026-08-12, no plan written yet. 6 literal UI strings ("Loading milestones…", "No milestones yet", "Milestone settings" ×2, "Default Milestone" help text, "Failed to load milestones.") → "Module" wording, across 4 files in `src/app/modules/work/**`. Component/class/file/route names unchanged. Companion to the backend repo's same-named design doc.

## Open items

- `2026-08-10-milestone-cards-and-tree-view-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (all 10 tasks across 3 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-card-settings-popup-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (9 tasks across 2 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-project-detail-inline-milestone-layout-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (4 tasks) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-milestone-card-uniform-height-and-default-select-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (3 tasks) finished the same day. See `specs/SUMMARY.md`.
