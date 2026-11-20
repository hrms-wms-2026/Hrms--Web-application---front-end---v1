# Task 12: Remove duplicate and unused code

| | |
|---|---|
| Priority | 12 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | Code quality |
| Depends on | nothing |

## What we found

The dev-env cleanup scan of 2026-11-13 reports:

- 295 duplicate blocks, 3,881 lines (2.1 percent of 1,082 files).
- Unused files: `core/config/build-info.ts`, `core/config/feature-flags.ts`, `shared/models/problem-details.model.ts`, `shared/ui/metric-stat`, two attendance stores (`device-change-requests.store.ts`, `location-change-requests.store.ts`), `landing-dashboard-preview`.
- 1 unused dependency (`emoji-picker-element-data`), 1 unused dev dependency (`prettier`), 7 unused exports, 12 unused types.
- `docs/core/CODE_CLEANUP_GUIDE.md` is being edited on this branch, so a cleanup process is already being defined. Follow it.

## What to do

1. Run `pwsh dev-env/scripts/cleanup-scan.ps1 frontend` for a fresh list.
2. Confirm each unused item before deleting: search for the name as a string, check the widget registry dynamic imports, route `loadComponent`, template-only selectors and `@defer` blocks.
3. Two cases need a question, not a delete: `problem-details.model.ts` (task 20 needs a shared error model, so this may be the one to adopt) and the two unused attendance stores (is the feature unfinished or replaced).
4. `prettier` is reported unused but the format check uses it. Verify before removing.
5. For duplicates, merge only copies that must change together: repeated form validators, date formatting, status-to-label maps, table column setups. Similar CSS in unrelated components stays.
6. Keep each commit to one theme and run `npm run check:warnings`, lint and the touched specs after each.

## Done when

- The scan shows no confirmed unused file or dependency.
- Duplicate lines are down by at least 25 percent.
- Build and full test suite pass.

## Status (2026-11-20)

- Report: `task-12-cleanup-report.md` (every Knip finding labelled, duplicate lines before/after per batch).
- Duplicate lines: 3,713 → 3,073 (-17.2%) on the base `f6e30e95` scan with generated files ignored. Target ≤ 2,784 not met: gap 289 lines, see report.
- Removed: `core/config/build-info.ts`, `core/config/feature-flags.ts`, `landing-dashboard-preview`, `metric-stat`, the home-page capsule CSS and `.html`, and six unused exports and types. Kept on purpose: `prettier`, `emoji-picker-element-data` (used), and the 4 SUSPECTED items listed in the report, which need an answer from their owners.
- Dashboard cards: 6 of 8 moved to `injectHostSize()` with the user's go-ahead; quick-actions and today-at-a-glance kept.
- Full test suite: only the pre-existing en-GB date failures (plus one flaky main-layout timeout that passes alone).
