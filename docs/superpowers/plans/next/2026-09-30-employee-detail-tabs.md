# Employee Detail — Tabbed Redesign

**Date:** 2026-09-30
**Status:** Phase 1 implemented; Phases 2–5 pending
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

## Phase 2 — Employment & Personal tab parity with the design

- Work Arrangement card (primary location, time zone, schedule), Team Memberships (plus Add to team), probation
  status/confirmation date.
- Personal tab edit per section, Contact/Address sections, Profile Completion %, Important Dates, Additional Info.
- Needs backend fields that `/employees/{id}/detail` does not return today: team memberships, time zone, schedule,
  confirmation date, work/personal phone, marital status, national ID, and profile completion.

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

## Verification (Phase 1)

- `ng test`: the people module is green. The old 28 detail tests are kept: 20 stay on the shell, and 8 moved to the
  overview, employment and personal tab specs. New specs cover the store, the header, utils, real-router tab links,
  the redirect, the period filter visibility and reload on id change.
- `ng build`: 0 errors.
- The full suite still has pre-existing failures in the attendance, calendar and date-range-picker specs. The same 7
  fail on the base commit. `flip-animate` flakes only in full parallel runs.
