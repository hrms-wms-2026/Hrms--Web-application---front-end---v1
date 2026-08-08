# plans/finished/ — Summary

One subfolder per completion date. Master status table: `../SUMMARY.md`.

## 2026-07-28/
- `2026-07-28-core-auth-login-legal-consent.md` — login → legal-consent-gate → dashboard flow scaffold. Date from filename.

## 2026-07-30/
- `2026-07-30-dashboard-skeleton-redesign.md` — black/white/gray dashboard shell, side/top navbar decomposition. Date from filename.

## 2026-08-03/
- `FRONTEND_AUTH_HTTPS_TENANT_REDIRECT_FIX_REPORT.md` — audit of the root↔tenant-host redirect flow; found already correct. Date inferred from git history (`git log --follow`).
- `FRONTEND_MKCERT_DEV_SERVER_CERT_FIX_REPORT.md` — wired `npm start` to the mkcert-issued cert/key so Chrome trusts local HTTPS. Date inferred from git history.
- `HTTPS_ONLY_LOCAL_AUTH_ALIGNMENT_REPORT.md` — removed mixed HTTP/HTTPS local dev support; HTTPS-only end to end. Date inferred from git history.

## 2026-08-06/
- `2026-08-06-legal-entity-general-settings.md` — implementation plan for Settings → General Settings page.
- `FRONTEND_AUTH_ROOT_HOST_LEGAL_ACCEPTANCE_FIX_REPORT.md` — fixed `acceptLegalDocuments()` to also retarget to the root host.
- `FRONTEND_LEGAL_ENTITY_PERMISSION_GATING_REPORT.md` — gated "Add Company" action behind `legal_entity:create`.
- `FRONTEND_ORG_SETTINGS_AUDIT_AND_IMPLEMENTATION_PLAN.md` — audit + plan (Part 1) preceding the Part 2A–2C work below.
- `FRONTEND_PART2A_PROFILE_APPEARANCE_UX_CORRECTION_REPORT.md` — topbar/profile popover/avatar/appearance UX corrections.
- `FRONTEND_PART2B_ORGANIZATION_SHELL_COMPANY_SELECTOR_REPORT.md` — Organization nav shell, sub-sidebar, company selector, selected-legal-entity state.
- `FRONTEND_PART2B_ORGANIZATION_SHELL_COMPANY_SELECTOR_CORRECTION_REPORT.md` — correction pass on Part 2B (root cause traced to backend seed data, not frontend).
- `FRONTEND_PART2C_LEGAL_ENTITY_GENERAL_SETTINGS_REPORT.md` — implementation report matching the `2026-08-06-legal-entity-general-settings.md` plan.

All 2026-08-06 dates inferred from git history except the one plan file that already carries the date in its filename.

## 2026-08-09/
- `2026-08-09-work-management-projects-milestones.md` — Work Management Projects List, Create/Edit/Delete/Achieve/Unachieve popups, Project Detail page, and read-only Milestone view, gated on `projects:access`. Design: `specs/finished/2026-08-09/2026-08-08-work-management-projects-milestones-design.md`. All 17 tasks executed 2026-08-09, one commit per task, full suite green throughout (347/364 — the 17 failures are the same pre-existing, unrelated set from before this work started). See the plan file's own "Execution report" section for deviations (all backend-blocker-related, all resolved before Task 1 started).
