# specs/next/ — Summary

- `2026-08-10-project-identifier-autosuggest-design.md` — status: approved 2026-08-10, no plan written yet. Auto-derives the Create Project form's Identifier field from the Name field (first word + 8-digit random suffix), stops once the user manually edits Identifier.
- `2026-08-10-project-detail-milestone-tree-view-design.md` — status: approved 2026-08-10, no plan written yet. Full-stack (frontend + `HRMS-Backend-v1`). Reworks Project Detail into 4 separate cards (compact header, tab-bar, 2/3 explorer-style milestone tree, 1/3 detail panel) with click-to-re-center tree navigation; removes the milestone-card row and `MilestoneCardComponent`; requires a backend DTO enrichment (`OwnerName`/`ReportingManagerName`/`IsOwner`/`IsAchieved`/`AchievedAt` added to `GetObjectiveSubtree`, name/owner fields also added to `GetObjectiveById`) — see the spec's "Backend change required" section for exact files.

## Open items

- `2026-08-10-milestone-cards-and-tree-view-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (all 10 tasks across 3 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-card-settings-popup-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (9 tasks across 2 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-project-detail-inline-milestone-layout-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (4 tasks) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-milestone-card-uniform-height-and-default-select-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (3 tasks) finished the same day. See `specs/SUMMARY.md`.
