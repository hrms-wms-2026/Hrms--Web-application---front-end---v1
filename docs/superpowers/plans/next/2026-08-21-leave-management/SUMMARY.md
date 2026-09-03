# Leave Management (Frontend) — Phase Index

**Spec:** `docs/superpowers/specs/next/2026-08-21-leave-management-design.md`
**Companion (backend):** `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md`
**Supersedes:** the Leave section of `plans/next/` — no frontend Leave plan existed before this one; the earlier `specs/next/2026-08-17-attendance-leave-management-design.md` sketch never had a plan file written for it.

Same 10-phase numbering as the backend index (0-9); Phase 0 is backend-only (schema), so frontend phases start at 1. Written in full: Phase 1 (`part-1-leave-types-frontend.md`) and Phase 2 (`part-2-leave-policies-frontend.md`). Later phases scoped here, not yet broken into TDD tasks.

---

## Phase 1 — Leave Types admin screen (Screen 1)

**Status:** written in full, see `part-1-leave-types-frontend.md`.

- `modules/leave/models/leave-type.model.ts`, `data-access/leave-type-api.service.ts`, `state/leave-type.store.ts`, `feature/leave-types-management/`, `ui/leave-type-list-table/`, `ui/leave-type-form-modal/`.
- Wired to `/time-off/types` inside a People-module-style inner `TIME OFF` sidebar that shows only `Leave Types` in this phase; gated on `leave:manage` (nav) / real backend `leave:read`+`leave:manage` (data).
- **Depends on:** backend Phase 0+1 (`part-1-schema-and-leave-types.md`) shipped and reachable.

## Phase 2 — Leave Policy admin screen (Screen 2)

**Status:** written in full, see `part-2-leave-policies-frontend.md`.

- 7-step create wizard matching the spec's Screen 2 exactly (policy name/description/country → leave type + accrual → eligibility → request rules + blackout → legal entity assignment → save & activate with replace-confirmation). Multi-type add-another-leave-type UI, blackout date-range picker.
- Wired to `/time-off/policies`; appends `Leave Policies` to the inner `TIME OFF` sidebar and still hides unbuilt pages.
- **Depends on:** Phase 1 (leave type picker needs the real list).

## Phase 3 — Entitlements + Balance screens (Screens 3 & 4)

- HR: bulk-generate wizard (year + legal entity + preview + results w/ CSV download), manual assignment, adjust, recalculate — `entitlements-management`.
- Employee: `my-balances` (donut per type, history table, carry-forward expiry banner) — becomes the default `/time-off` landing page.
- Manager: `team-balances`.
- **Depends on:** Phase 2 (policy is the generation source).

## Phase 4 — New Request (Screen 5)

- 5-step form: type dropdown with "N days remaining" per type, date range + half-day toggle + calendar warnings, live total + insufficient-balance/notice-period/blackout messaging, reason + document upload, review + submit.
- Triggered from `/time-off` (My Balances) and from calendar date-click.
- **Depends on:** Phase 3 (balance preview data).

## Phase 5 — Approvals (Screens 6 & 8)

- `pending-approvals` (`/time-off/team`) — action-card-style detail sheet: employee info, balance impact, team coverage, conflict snapshot (submission vs. current, NEW badges), approve/reject/request-info, bulk actions.
- `requests-list` (`/time-off/all`, HR) — filterable table.
- **Depends on:** Phase 4.

## Phase 6 — Cancellation (Screen 9)

- Cancel action + confirm dialog on My Leave rows and All Requests rows, partial-cancel date picker for in-progress leave, reason field (required for HR, optional for employee).
- **Depends on:** Phase 5.

## Phase 7 — Team Calendar (Screen 7)

- Month view, colour-by-type, department filter, click-day-for-detail.
- Wired to `/time-off/calendar`.
- **Depends on:** Phase 4 (approved requests to render).

## Phase 8 — Balance Audit + CSV export

- Audit trail panel on Entitlements screen, CSV export buttons on Balances/Entitlements.
- **Depends on:** Phase 3.

## Phase 9 — Hardening

- Full `.spec.ts` pass on every store (state-transition assertions matching `department.store.spec.ts`'s pattern), Playwright E2E for the golden path (submit → approve → balance updates), a11y pass (skip-link/focus/contrast per the frontend architecture doc's target policy).
- Retire nothing — this build never had a mocked phase to retire (unlike the superseded 2026-08-17 sketch).
