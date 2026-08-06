# Documentation & Process Rules

These rules govern how `docs/` is maintained in this frontend repo. They apply to every future task in this project unless the user explicitly overrides one. They mirror the equivalent rules already in force in the backend repo (`HRMS-Backend-v1/docs/superpowers/rules/PROCESS_RULES.md`), adapted to this repo's own doc layout (no `postman-request/` or `workflow/` folder here).

## 1. Plan before non-trivial work

Write an implementation plan to `docs/superpowers/plans/next/YYYY-MM-DD-<topic>.md` before starting code or document changes, for anything beyond a one-line fix.

## 2. Keep `docs/core/ARCHITECTURE.md` current

Whenever a decision, code change, or investigation changes what `ARCHITECTURE.md` describes (folder structure, state management pattern, security architecture, etc.), update that document as part of finishing the task — not as a deferred follow-up.

## 3. Every `docs/superpowers/` subfolder maintains its own `SUMMARY.md`

Update the folder's `SUMMARY.md` in the same change that adds, removes, or significantly edits a file in that folder, so a fresh session can load folder context without reading every file in it.

## 4. Edit boundary

`docs/core/ARCHITECTURE.md` gets content edits as part of doc-sync work (rule 2). `plans/` and `specs/` only receive **new** files (new plans, new reports) — an existing file there is only changed if the user explicitly asks for that specific file to change.

## 5. `docs/superpowers/plans/` and `docs/superpowers/specs/` follow `FILE_CREATION_RULES.md`

Both folders are organized into `finished/` (completed, split into per-date subfolders) and `next/` (pending + raw future-feature context, stays flat). Every plan/design has a `pending`/`finished` status tracked in its folder's `SUMMARY.md`. New files that don't fit in one (~300-line target, but the real trigger is whether one task fits in one file) are split by independent sub-task into `plans/next/<date>-<topic>/part-1.md`, `part-2.md`, etc. — each part must be fully self-contained. This splitting rule is for new file creation only; existing files are migrated by moving + status-tagging, never retroactively split. Full detail in `FILE_CREATION_RULES.md`.

**Origin:** established 2026-08-06, mirroring the backend repo's identical rule (its own `FILE_CREATION_RULES.md` rule 7), applied to this repo's `docs/superpowers/plans/` and `docs/superpowers/specs/` at the same time — migrating the 13 pre-existing `plans/` files and 2 `specs/` files into `finished/<date>/` (dates inferred from git history where not stated) and the former `docs/superpowers/next-plan/Project Management.md` into `plans/next/Project Management.md`.
