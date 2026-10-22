# Time Tracking Frontend — Timezone Correction Report

**Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
**Date:** 22 August 2026  
**Scope:** Frontend correction only. Backend files were not changed. Nothing was committed or pushed.

## Root Cause

The Time Tracking component formatted attendance timestamps with:

```ts
new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
}).format(date);
```

Because no `timeZone` option was supplied, the browser selected its local timezone. That caused clock-in and clock-out times to be incorrect for users or managers whose browser timezone differed from the legal entity’s timezone.

The backend contract already provides `AttendanceTodayResponse.Timezone`, while `AttendanceHistoryRow` does not contain a timezone field. The correction therefore uses the legal-entity timezone from Today for Today timestamps and for both personal and covered-history rows.

## Files Changed

| Area | Files |
|---|---|
| Timezone-aware display logic | `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` |
| Timestamp call sites | `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html` |
| Regression coverage | `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts` |
| Correction documentation | `TIME_TRACKING_FRONTEND_TIMEZONE_CORRECTION_REPORT.md` |

The existing route, nav, model, store, and API service were inspected and did not require changes for this display-only correction. The current route and nav gates were intentionally preserved.

## Exact Timezone Behavior

The component now exposes a timezone-aware formatter:

```ts
formatDateTime(value: string | null, timezone?: string | null): string
```

The formatter performs the following steps:

| Input condition | Display behavior |
|---|---|
| `value` is `null` or empty | Returns `—` |
| Timestamp cannot be parsed | Returns `—` |
| `timezone` is missing | Uses explicit display-only fallback `UTC` |
| `timezone` is an invalid runtime timezone identifier | Returns `—` without throwing or logging a console error |
| Valid timestamp and timezone | Formats with `Intl.DateTimeFormat` and `timeZone: timezone` |

The Today card passes `today.timezone` directly for Today clock-in and clock-out values. Personal history and covered/team history pass the computed `displayTimezone`, which reads `store.today()?.timezone` and uses `UTC` only while Today has not loaded yet. The fallback is intentionally not the browser timezone and is documented in the component source.

For current company-scoped Time Tracking, the Today response identifies the selected legal entity context. The history and covered-history rows do not currently carry a per-row timezone, so the selected company’s Today timezone is the correct available display context.

## Backend Contract Basis

The implementation continues to use the existing backend contracts:

| Backend contract | Relevant timezone fact |
|---|---|
| `src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs` | `AttendanceTodayResponse` includes `string Timezone`; `AttendanceHistoryRow` includes timestamps but no timezone field. |
| `src/ONEVO.Api/Controllers/Tenant/Attendance/TimeTrackingController.cs` | Today, personal history, and covered history are tenant-authenticated endpoints; only covered history has `[RequirePermission("attendance:read")]`. |

No frontend-only timezone field was added to the DTO models. The formatter validates the identifier through `Intl.DateTimeFormat` and safely returns `—` for invalid data.

## Permission and Navigation Sanity Check

The current gates were not changed:

```text
Module: time_attendance
Self-service/read permissions: attendance:read-own, attendance:write-own, attendance:read
Covered/team permission: attendance:read
```

The route remains `/attendance/time-tracking`, and the Attendance sidebar item continues to point to that route. The self-service page is not gated exclusively by manager access. Based on the current backend permission-resolution evidence, `attendance:read-own` and `attendance:write-own` are internal/module auto-granted self-service permissions, while `attendance:read` is the manager/coverage permission for Team attendance.

If `/auth/me` does not return the module auto-grants for self-service users, the Attendance navigation may be hidden even though Today/history/actions are tenant-authenticated self-service capabilities. That would require correction in backend permission resolution rather than weakening the frontend gate.

## Tests Added or Updated

The component spec now verifies:

| Scenario | Coverage |
|---|---|
| Today timestamps | Clock-in and clock-out are formatted using `Asia/Colombo`, not UTC/browser-local formatting. |
| Personal history | History rows use the current Today timezone. |
| Covered history | Team rows use the current Today timezone. |
| Invalid timezone | No exception is thrown and the result is `—`. |
| Invalid timestamp | The result is `—`. |
| Null timestamp | The result is `—`. |
| Covered access | Team attendance remains hidden without `attendance:read` and visible with it. |

The timezone assertions use a fixed UTC timestamp and compare the expected `Asia/Colombo` rendering with the UTC rendering, so they do not depend on the machine running the tests.

## Verification Commands

| Command | Result |
|---|---|
| `npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"` | Passed — 3 test files, 22 tests |
| `npx ng test --no-watch --include "src/app/layouts/**/*.spec.ts"` | Passed — 9 test files, 65 tests |
| `npm run build` | Passed — Angular bundle generated successfully with no Angular errors |
| `git diff --check` | Passed — exit code 0 |

The build still emits unrelated pre-existing Angular extended-diagnostic warnings in other Work-module components; no Angular errors were reported and the Time Tracking component stylesheet did not exceed its configured budget.

## Skipped Checks

No backend tests were run because this correction is frontend-only and the instruction prohibits backend edits. No live authenticated browser/API test was run because it requires a tenant session and a running backend. No per-row timezone behavior was tested because the current history DTOs do not expose a per-row timezone.

## Remaining Backend Contract Risk

`history` and `covered-history` rows do not carry a per-row timezone. The frontend therefore uses `Today.timezone` for the selected company context. This is sufficient for the current company-scoped Time Tracking screen, but it is not sufficient if a future covered-history endpoint returns records across multiple legal entities or otherwise mixes timezone contexts. The backend/frontend contract should then add an authoritative timezone per row or guarantee a single legal-entity scope.

A second contract risk is permission resolution: if `/auth/me` omits the backend module auto-granted self-service permissions, the current intentionally conservative frontend nav/route gate may hide Attendance from otherwise eligible self-service users. That should be resolved in backend auth permission resolution, not by exposing the route without the documented gates.

## Repository State

No files under `HRMS-Backend-v1` were modified by this correction. The backend repository already contained unrelated working-tree changes when it was checked; those changes were not edited, staged, committed, or pushed. Nothing was committed or pushed by this task. The correction report and source changes remain in the requested frontend working tree.
