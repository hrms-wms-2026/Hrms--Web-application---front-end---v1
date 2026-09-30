# Employee Detail — Tabbed Redesign

**Date:** 2026-09-30
**Status:** Phases 1–2 and the design-parity pass implemented; Phases 3–5 pending
**Design source:** four mockups (Overview, Employment, Work & Activity, Personal) supplied by the product owner.
There is no Attendance tab mockup yet.

## Goal

Replace the single-page `/people/employees/:id` view with a tabbed employee profile: a shared profile header,
five routed tabs (Overview, Employment, Attendance, Work & Activity, Personal), and a reporting-period filter
for the period-based tabs.

## Phase 1 — Shell, header, tabs (frontend only) — implemented

- `feature/employee-detail/employee-detail.component.ts` is now the shell. It owns the breadcrumb, the
  `ui/employee-profile-header` banner, the header actions, the tab bar, the period filter and the `<router-outlet>`.
  The header actions are Transfer / Promote, Offboarding and Resend invitation, with the same permission gating as before.
- `state/employee-detail.store.ts` is a `signalStore` without `providedIn`. The shell provides it, so each page gets a
  fresh instance and the routed tabs share it. It loads `/employees/{id}/detail` and position history,
  ignores stale responses when the id changes, owns the job-details save flow, and holds `periodMonth` (`YYYY-MM`).
- The shell loads from `route.paramMap`, not the snapshot, so switching employees while on a child tab reloads.
- Child routes under `:id` are `''` (redirects to `overview`), `overview`, `employment`, `attendance`,
  `work-activity` and `personal`. `:id/offboarding` is now declared before `:id`.
- Tab content:
  - **Overview:** Attendance today (moved from the old header strip), Employment & Organization, and Employee History
    (latest 5 position changes).
  - **Employment:** editable Job Information, Employment Record, and the Job Journey timeline.
  - **Personal:** Personal Information, Emergency Contacts, and Payroll & Statutory (only when the response includes
    payroll). The design has no slot for payroll, so it lives here.
  - **Attendance, Work & Activity:** empty-state placeholders (`EmployeeUpcomingTabComponent`) until the backend
    aggregates exist.
- Not built on purpose: the design's **Edit Employee** button and the `…` menu. There is no whole-profile edit flow to
  back them yet. Job details stay editable inline on the Employment tab.
- Shared helpers (`initials`, `tenure`, `primary location`, period month maths) are in `utils/employee-detail.utils.ts`.

## Phase 2 — Employment & Personal tab parity with the design — implemented (read-only)

Decisions (2026-09-30, product owner):
- The first pass is read-only. Per-section **Edit** on the Personal tab needs admin-scoped personal, contact, address and
  emergency-contact commands, and today only `me/...` exists. That work moves to a later phase.
- **Team Memberships** becomes **Project Memberships**, backed by Work Management `project_members`. There is no Teams
  entity.
- Fields the backend doesn't store are skipped, with no placeholders: marital status, national ID/passport,
  work vs personal phone, confirmation date, documents, preferences.

Backend (`HRMS-Backend-v1`, branch `feature/employee-detail-phase2`):
- `GET /employees/{id}/detail` adds `jobInformation.timezone`. It uses the employee's `DisplayTimezone` and falls back
  to the legal entity's timezone.
- It also adds `projectMemberships[]` (`projectId`, `projectName`, `memberSince`, `isActive`). These are **limited to
  projects the viewer is also an active member of**, through
  `IProjectMemberRepository.ListSharedProjectMembershipsAsync`. Work Management project visibility is
  relationship-based, and `ListProjectsQueryHandler` refuses to list another employee's projects.

Frontend:
- **Employment tab:** section header; Job & Organizational Details (inline edit unchanged); Work Arrangement (work
  mode, primary location, time zone); Employment Record (status, hire date, tenure, probation status badge and end
  date); Project Memberships table; Employment History timeline.
- **Personal tab:** Personal, Contact and Address cards; the Emergency Contact card; Payroll (only when returned).
  The side column has Profile Completion (ring plus checklist), Important Dates (hire date, next work anniversary with
  days until) and Additional Information (employee ID, department, position, employment type, work mode, time zone).
- Profile completion counts only the sections the response carries: basic (first and last name, date of birth,
  gender), contact (email and phone), at least one address, and at least one emergency contact.

## Design parity pass (component kit) — implemented

The product owner asked for all four screens to match the mockups exactly (2026-09-30):
- A reusable kit lives in `modules/people/ui/detail-kit/`: `detail-icon`, `detail-card`, `kv-row`, `stat-tile`,
  `status-badge`, `segmented-bar`, `bar-chart`, `line-chart`, `timeline`, `empty-note` and `insight-placeholder`.
  The header, tab bar (with icons), period select and month button, and all tabs are rebuilt on it.
- **Overview** and **Work & Activity** are fully built. The real-data cards are Employment & Organization, Employee
  History and Attendance today. The period cards read `EmployeeInsightsStore` → `EmployeeInsightsApiService`, which
  serves `employee-insights.mock.ts` (the designed Phase 3 response shape, `models/employee-insights.model.ts`) **only
  in the development environment**. Every other environment gets `null`, and the cards show "No data yet", so
  production never shows invented numbers. The period filter now drives these loads.
- Header actions: **Edit Employee** opens the Employment tab's job-details form (`?edit=job`). **Transfer / Promote**
  keeps the Promotion/Transfer menu. **More** (…) holds Offboarding and Resend invitation, with the same gating as
  before. Buttons with no backend are left out: Personal "Edit", "Add to team", "View task", and the productivity
  compare selects.
- Employment history is derived from real position history: the earliest entry is "Joined company",
  Promotion/Transfer entries become "Promoted"/"Transferred", and a passed probation end date adds "Probation
  completed". `employee-job-journey` was removed.
- Profile completion follows the design's rule: a name on file means basic is complete, and an email or phone means
  contact is complete.
- Bug found and fixed while testing: the insights load effect tracked store signals, so a `null` result re-triggered
  the load forever. The loads are now `untracked`, and a regression test covers it.
- Checked visually in a local preview at the mockups' 1672px width with stubbed services (not committed).
- In Phase 3, swap `EmployeeInsightsApiService` for HttpClient calls to
  `GET /employees/{id}/overview-insights?month=` and `GET /employees/{id}/work-activity-insights?month=`.

## Phase 3 — Backend employee-scoped aggregates (HRMS-Backend-v1)

All endpoints are read-only, gated on `employees:read` (plus module permission) and tenant-isolated, with a
`from`/`to` period:
`attendance-summary`, `work-summary`, `activity-summary`, `time-off-summary` and `activity-feed` under
`/employees/{id}/`. The existing endpoints are all `my-*` (self-scoped) and do not cover the manager view.
Decide the productivity "work insight index" formula before building it.

## Phase 4 — Overview & Work & Activity cards

Wire the period-based cards to Phase 3 endpoints through `EmployeeDetailStore.periodMonth`.

## Phase 5 — Attendance tab

Blocked on a design.

## Verification (Phase 2)

- Backend: 4759/4759 unit tests (13 detail-handler tests, 5 of them new) and 695/695 architecture tests. The integration
  test project builds.
  `ListSharedProjectMembershipsAsync` has **no integration test yet**: Docker wasn't running, so its EF translation and
  RLS behaviour haven't been exercised against PostgreSQL.
- Frontend: people module 427/427, `ng build` 0 errors.

## Verification (Phase 1)

- `ng test`: the people module is green. The old 28 detail tests are kept: 20 stay on the shell, and 8 moved to the
  overview, employment and personal tab specs. New specs cover the store, the header, utils, real-router tab links,
  the redirect, the period filter visibility and reload on id change.
- `ng build`: 0 errors.
- The full suite still has pre-existing failures in the attendance, calendar and date-range-picker specs. The same 7
  fail on the base commit. `flip-animate` failed once in a full run and passed on two reruns (and on the base commit).
