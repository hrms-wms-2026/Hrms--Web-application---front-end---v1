# specs/next/ — Summary

- `2026-08-10-project-identifier-autosuggest-design.md` — status: approved 2026-08-10, no plan written yet. Auto-derives the Create Project form's Identifier field from the Name field (first word + 8-digit random suffix), stops once the user manually edits Identifier.
- `2026-08-10-milestone-cards-and-tree-view-design.md` — status: approved 2026-08-10, no plan written yet. Milestone card grid (View/Edit/Achieve, ownership-gated) + new Milestone Detail tree-view page. Cross-repo — blocked on the backend addendum (`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-10-milestone-ownership-and-subtree-access-design.md`) shipping first, since it needs the new `isOwner` field and loosened `GetObjectiveSubtree` permission.
