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

## 6. Code and docs change together, in the same commit

Any change that creates or edits a component, store, API service, model, or route — and any change that introduces or alters how components communicate (inputs/outputs, store methods, new module) — updates the relevant doc in the *same* change, not as a deferred follow-up:

- New/changed component, store, service, or data-flow pattern → reflect it in `docs/core/ARCHITECTURE.md` (folder tree in §2, and the relevant pattern section, e.g. §4 for state, if the pattern itself is new or deviates from the documented standard).
- New/changed feature → the plan/spec files that describe it, per rules 1 and 5 above.
- Component composition and data communication must follow the documented standard (`ARCHITECTURE.md` §2 "Layer Purpose — Quick Reference" and §4): `feature/` = smart container (injects the store, owns local UI `signal()` state, no direct API calls), `ui/` = dumb/presentational (`input()`/`output()` only, no store injection, no API calls), and the `feature → ui → state → data-access` dependency direction is never inverted. A design or plan that proposes deviating from this must say so explicitly and why.

**Origin:** established 2026-08-10, on user request, after `docs/core/ARCHITECTURE.md`'s folder tree was found to have never been updated for the `work` module (built 2026-08-03 onward) despite Rule 2 already existing — the rule existed but wasn't specific enough about *component-level* data-communication docs to catch that gap. This rule generalizes rule 2 from "keep ARCHITECTURE.md current" to an explicit, non-deferrable, same-commit requirement covering component/data-flow docs specifically.
