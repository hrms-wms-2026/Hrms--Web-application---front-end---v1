# specs/next/ — Summary

- `2026-08-10-project-identifier-autosuggest-design.md` — status: approved 2026-08-10, no plan written yet. Auto-derives the Create Project form's Identifier field from the Name field (first word + 8-digit random suffix), stops once the user manually edits Identifier.
- `2026-08-10-project-detail-inline-milestone-layout-design.md` — status: approved 2026-08-10 (visual mockup), no plan written yet. Compact project header card, horizontal-scroll milestone cards (no View button, whole card clickable), inline detail panel below reusing `ProjectDetailStore`'s pre-existing (unused since the routed version shipped) `loadMilestoneSubtree`/`selectedSubtree` state. Removes the standalone `/work/:projectId/milestones/:objectiveId` route and `MilestoneDetailComponent`.

## Open items

- `2026-08-10-milestone-cards-and-tree-view-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (all 10 tasks across 3 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-card-settings-popup-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (9 tasks across 2 parts) finished the same day. See `specs/SUMMARY.md`.
