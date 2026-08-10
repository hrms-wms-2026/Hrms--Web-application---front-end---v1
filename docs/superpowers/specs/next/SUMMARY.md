# specs/next/ — Summary

- `2026-08-10-project-identifier-autosuggest-design.md` — status: approved 2026-08-10, no plan written yet. Auto-derives the Create Project form's Identifier field from the Name field (first word + 8-digit random suffix), stops once the user manually edits Identifier.
- `2026-08-10-milestone-card-uniform-height-and-default-select-design.md` — status: approved 2026-08-10, no plan written yet. Host-level `h-full` on `CardComponent`/`MilestoneCardComponent` so cards in the horizontal-scroll row stretch to match the tallest sibling (root cause: nothing propagated the flex row's stretch height into the visible card box). First milestone auto-selected on load via the same code path a click already uses.

## Open items

- `2026-08-10-milestone-cards-and-tree-view-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (all 10 tasks across 3 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-card-settings-popup-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (9 tasks across 2 parts) finished the same day. See `specs/SUMMARY.md`.
- `2026-08-10-project-detail-inline-milestone-layout-design.md` moved to `specs/finished/2026-08-10/` on 2026-08-10 — its plan (4 tasks) finished the same day. See `specs/SUMMARY.md`.
