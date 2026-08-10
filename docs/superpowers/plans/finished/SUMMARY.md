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

## 2026-08-10/
- `2026-08-10-milestone-cards-and-tree-view/` (3-part split plan: `part-1-data-layer.md`, `part-2-card-and-edit-achieve.md`, `part-3-tree-view-page.md`) — Milestone card grid on Project Detail (View always shown, Edit/Achieve/Unachieve gated by the new `isOwner` field), a dedicated Milestone Detail tree-view page at `/work/:projectId/milestones/:objectiveId`, and a `MilestoneFormModalComponent` that fetches full Objective detail before opening (avoiding the same "list-row lacks description" bug fixed for Projects the same session). Design: `specs/finished/2026-08-10/2026-08-10-milestone-cards-and-tree-view-design.md`. Cross-repo — blocked on and built after the backend's `2026-08-10-milestone-ownership-and-subtree-access.md` (`HRMS-Backend-v1`). All 10 tasks across 3 parts executed 2026-08-10, one commit per task, full `work` module suite green throughout (101/101 final).
- Also landed this session but from earlier, uncommitted work: `fix(work): fetch full detail before Edit + add color/logo form fields` — Project List's Edit modal now fetches full `ProjectDetail` before opening (same class of bug as the milestone fix above, fixed first and used as the template for it), plus Color/Logo fields added to the Create/Edit Project form. Not part of a numbered plan (predates this plan; see git log for the commit).
- `2026-08-10-card-settings-popup/` (2-part split plan: `part-a-milestone-settings.md`, `part-b-project-settings.md`) — consolidates each card's Edit + Achieve/Unachieve buttons into a single gear-icon Settings popup with an Achieved toggle, for both `MilestoneCardComponent` and `ProjectCardComponent`. Design: `specs/finished/2026-08-10/2026-08-10-card-settings-popup-design.md`. Part A (Milestone) has achieve-state-dependent save ordering (`EditObjectiveCommandHandler` rejects edits once achieved — unachieve-first when turning the toggle off, edit-then-achieve-last when turning it on); Part B (Project) has no such constraint (`EditProjectCommandHandler` has no achieved check). `ProjectFormModalComponent` simplified to Create-only; `MilestoneFormModalComponent`/`ProjectCardComponent`'s and `MilestoneCardComponent`'s old Edit/Achieve outputs removed. All 9 tasks across 2 parts executed 2026-08-10, one commit per task, full `work` module suite green at each task boundary that didn't have an anticipated cross-file transient break (both parts' final wiring task closes those breaks; documented inline in the plan). 108/108 final.
- `2026-08-10-project-detail-inline-milestone-layout.md` — approved via a visual mockup (2 iterations, user removed the View button mid-review). Compact project header card, horizontal-scroll milestone cards (whole card clickable, no View button, `⚙` stays a separate click target via `stopPropagation`), inline detail panel below reusing `ProjectDetailStore`'s `loadMilestoneSubtree`/`selectedSubtree`/`clearSelectedSubtree` — state that existed since the module's original pre-route design and had sat unused since `2026-08-10-milestone-cards-and-tree-view` moved to a dedicated route. That route and `MilestoneDetailComponent` are removed here. Design: `specs/finished/2026-08-10/2026-08-10-project-detail-inline-milestone-layout-design.md`. All 4 tasks executed 2026-08-10, one commit per task, full `work` module suite green throughout except Task 1 (isolated component change, expected) — no transient cross-file break this time, unlike the two plans above. 110/110 final.
- `2026-08-10-milestone-card-uniform-height-and-default-select.md` — root cause: milestone cards already had equal width but no level in `app-milestone-card` → `app-card` → `<section>` propagated the flex row's stretch height into the visible bordered box. Fixed via `host: { class: 'block h-full' }` on both `CardComponent` (shared) and `MilestoneCardComponent`, not a fixed pixel height — verified against the full (non-`work`) suite since `CardComponent` is shared, no other consumer affected. Also: first milestone auto-selects on load via the same `onMilestoneSelected` a click already uses. Design: `specs/finished/2026-08-10/2026-08-10-milestone-card-uniform-height-and-default-select-design.md`. All 3 tasks executed 2026-08-10, one commit per task; the auto-select test needed an extra `Promise.resolve()` pair since `ngOnInit` now chains two awaits before selecting (found during execution, plan doc corrected). 113/113 final.
