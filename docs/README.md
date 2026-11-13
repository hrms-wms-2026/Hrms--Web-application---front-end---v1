# Frontend docs

Start here. Every document about this repo lives under `docs/`, apart from the root [`../README.md`](../README.md) and [`../CLAUDE.md`](../CLAUDE.md).

## Where things are

| Folder | What's in it |
|---|---|
| [core/](core/) | **Living architecture.** [ARCHITECTURE.md](core/ARCHITECTURE.md): stack, folder tree, state management, HTTP interceptors, realtime (SignalR), security (session cookie, CSRF, rich-text sanitizing), error handling. [MODULE_MAP.md](core/MODULE_MAP.md): every module, what it does, its pages and where its docs are. [CODE_CLEANUP_GUIDE.md](core/CODE_CLEANUP_GUIDE.md): set up Knip, jscpd and Roslyn and remove dead or duplicated code safely (frontend + backend). |
| [design/](design/) | Visual design rules: colour palettes, component design rules, shadows/elevation, icon theme system. |
| [superpowers/specs/](superpowers/specs/) | Designs. `next/` = approved, not built yet; `finished/<date>/` = built. Index: [specs/SUMMARY.md](superpowers/specs/SUMMARY.md). |
| [superpowers/plans/](superpowers/plans/) | Implementation plans. Same `next/` / `finished/<date>/` split. Index: [plans/SUMMARY.md](superpowers/plans/SUMMARY.md). |
| [superpowers/rules/](superpowers/rules/) | How docs are created and kept current: [PROCESS_RULES.md](superpowers/rules/PROCESS_RULES.md), [FILE_CREATION_RULES.md](superpowers/rules/FILE_CREATION_RULES.md). |
| [reports/](reports/) | Point-in-time reports, one folder per area. `work-management/user-journey/` holds the Work Management and Inbox user journeys with screenshots. |
| [todo.md](todo.md) | Running to-do list. |

### Report areas

`attendance`, `auth`, `clock-in-policy`, `code-quality`, `employee`, `employee-onboarding`, `legal-entity`, `organization`, `performance`, `time-tracking`, `work-management`.

## Quality, testing and security

- **Commands:** `npm run lint` (ESLint, must be 0 errors), `npm run check:warnings` (zero-warnings production build, also the pre-push hook), `npm test` (Vitest), `npm run e2e` (Playwright). The combined gate and the security scanners are in `../dev-env/` (outside the repo); see [`../CLAUDE.md`](../CLAUDE.md).
- **Latest hardening pass:** [reports/code-quality/2026-10-27-uat-hardening-report.md](reports/code-quality/2026-10-27-uat-hardening-report.md) — Angular CVE upgrade, ESLint introduction and lint backlog, stored-XSS fix in the rich-text editor.
- **Security rules for new code:** ARCHITECTURE.md §6.2 (never write data to `innerHTML` without `sanitizeEditableHtml()`, no `bypassSecurityTrust*`), §6.1 (no tokens in the frontend; session cookie only).
- **Known gaps between frontend and backend:** see the backend repo's `docs/reports/documentation/2026-10-28-docs-and-code-gap-audit.md`.

## Conventions

- File names: lowercase kebab-case. Dated docs start with `YYYY-MM-DD-`.
- New reports go in `reports/<area>/`. New plans and designs go in `superpowers/plans|specs/next/` and move to `finished/<date>/` once built; nothing stays loose in `plans/`, `specs/` or `finished/`.
- Move files with `git mv` so history follows them, and update the folder's `SUMMARY.md` in the same change.
- When code changes what `core/ARCHITECTURE.md` describes, update it in the same change (PROCESS_RULES rule 6).
