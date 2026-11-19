# Time Tracking Frontend — Part 1 Implementation Report

**Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
**Date:** 22 August 2026  
**Scope:** Frontend only. Backend files were not modified. No commit or push was performed.

## Summary

The Attendance → Time Tracking foundation is implemented as a lazy-loaded Angular feature at `/attendance/time-tracking`. The page loads the current employee’s attendance state, provides backend-driven self-service actions, shows personal history for the current calendar week by default, and exposes covered/team history only when the signed-in user has `attendance:read` and the Today response allows covered-employee visibility.

The implementation uses the application’s existing Angular standalone component, NgRx Signal Store, permission guard, navigation configuration, centralized error sanitization, notification, date-picker, and theme-token patterns.

## Files Changed

| Area | Files |
|---|---|
| Route and navigation | `src/app/app.routes.ts`, `src/app/modules/attendance/attendance.routes.ts`, `src/app/app.routes.spec.ts`, `src/app/layouts/main-layout/nav/nav-items.config.ts`, `src/app/layouts/main-layout/nav/nav-access.spec.ts`, `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts` |
| Backend-aligned models | `src/app/modules/attendance/models/time-tracking.model.ts` |
| API service | `src/app/modules/attendance/data-access/time-tracking-api.service.ts`, `src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts` |
| Signal Store | `src/app/modules/attendance/state/time-tracking.store.ts`, `src/app/modules/attendance/state/time-tracking.store.spec.ts` |
| Time Tracking page | `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`, `.html`, `.css`, `.spec.ts` |

No files under `HRMS-Backend-v1` were changed.

## Actual Backend Contracts Used

The implementation was based on the requested backend controller, response DTO, query declarations, and `ClockInRequest` contract rather than screenshots or inferred report fields.

| Backend source | Contract used |
|---|---|
| `src/ONEVO.Api/Controllers/Tenant/Attendance/TimeTrackingController.cs` | Base route `/api/v1/attendance/time-tracking`; `GET today`, `GET history`, `GET covered-history`, and the four POST mutation routes. The controller returns the DTO/list directly rather than an additional frontend envelope. |
| `src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs` | `AttendanceTodayResponse`, `AllowedClockInMethods`, `AttendanceHistoryEmployee`, and `AttendanceHistoryRow`, including schedule/policy state, break values, action flags, employee data, and capability flags. |
| `src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadQueries.cs` | `history` and `covered-history` accept `DateOnly From`, `DateOnly To`, and optional `Guid? EmployeeId`; Today is self-service. |
| `src/ONEVO.Api/Contracts/Attendance/TimeTracking/ClockInRequest.cs` | Clock-in accepts only `{ source: string }`; the frontend sends exactly `{ source: 'web' }`. |

The `startBreak`, `endBreak`, and `clockOut` calls use `HttpClient.post(url, null)`. Angular’s direct `HttpClient` API requires a body argument, and `null` produces an empty POST body. No tenant ID, employee ID, legal-entity ID, date, timestamp, timezone, duration, or location is sent.

## Route and Permission Gates

The new lazy-loaded route is:

```text
/attendance/time-tracking
```

The parent `/attendance` route uses the existing `permissionGuard` with the `time_attendance` module entitlement and any one of the self-service/read permissions: `attendance:read-own`, `attendance:write-own`, or `attendance:read`. This permits self-service users without requiring manager-only access. The Attendance sidebar item uses the same module and permission gate and now points directly to `/attendance/time-tracking`.

The former `/time-attendance` placeholder path remains as a compatibility redirect to `/attendance/time-tracking`. Covered/team history is rendered only when `PermissionService.hasPermission('attendance:read')` is true. The page also honors `today.canViewCoveredEmployees`; therefore, the UI does not expose covered records solely because a user can reach the self-service page.

## API Service and Signal Store

`TimeTrackingApiService` provides the following typed methods:

| Method | Request |
|---|---|
| `getToday()` | `GET /attendance/time-tracking/today` |
| `getMyHistory(from, to)` | `GET /attendance/time-tracking/history?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `getCoveredHistory(from, to, employeeId?)` | `GET /attendance/time-tracking/covered-history` with `from`, `to`, and optional `employeeId` query parameters |
| `clockIn()` | `POST /attendance/time-tracking/clock-in` with `{ source: 'web' }` |
| `startBreak()` | Empty `POST /attendance/time-tracking/break/start` |
| `endBreak()` | Empty `POST /attendance/time-tracking/break/end` |
| `clockOut()` | Empty `POST /attendance/time-tracking/clock-out` |

`TimeTrackingStore` owns Today, personal history, covered history, selected range, loading flags, error state, and active mutation state. A second mutation call is ignored while another action is in flight. Every successful mutation replaces the stored Today response with the backend response and emits the required success notification: `Clocked in.`, `Break started.`, `Break ended.`, or `Clocked out.`

Mutation failures are passed through `ErrorHandlerService.toSafeMessage` and emitted through the centralized `NotificationService`, so raw machine values are not shown. Covered-history HTTP 403 responses receive the specific friendly message: `You do not have access to view team attendance.`

## Time Tracking Page UI

The page is an operational card-based screen rather than a raw API/debug view. It includes the current work date, scheduled work start/end times, timezone, break allowance, break used and remaining time, worked time, attendance status, work mode, source, and human-readable schedule or policy messages.

Action buttons are rendered from the Today response flags only:

| Backend flag | UI action |
|---|---|
| `canClockIn` | `Clock in` |
| `canStartBreak` | `Start break` |
| `canEndBreak` | `End break` |
| `canClockOut` | `Clock out` |

Impossible actions are not presented as enabled. If no action is available, the page says that no attendance actions are available right now. The page also displays `You have not clocked in yet.` whenever `shouldHaveClockedIn` is true.

Break allowance remains visible whenever it is configured. Remaining minutes and used minutes are shown in human-readable form. A zero remaining value uses a lighter visual treatment, a hover title, and the helper text `You have used your break time for today.` The UI does not use “expired” or expose backend machine codes.

Personal history uses `GET /history` and defaults to the current calendar week, Monday through Sunday. The selected range is displayed through the existing shared date-picker component and can be changed by the user.

Covered/team history uses `GET /covered-history`, displays employee identity and attendance rows, and is hidden for users without `attendance:read`. There is no separate unauthorized route or employee-list N+1 request path.

## People Employee-List Indicator

The requested People-list indicator was deferred. The existing People employee-list response model contains employee identity, organization, status, reporting, and invitation fields, but no attendance warning, missed-clock-in, or ordering metadata. Because the required data contract is not available, the implementation does not fake the red profile ring, does not sort employees based on unavailable data, and does not make one Today request per employee.

**TODO:** Define and implement a backend/frontend People-list contract that supplies attendance warning state and ordering information in the list response, then wire the indicator without N+1 calls.

## Tests Run

| Command | Result |
|---|---|
| `npx ng test --no-watch --include "src/app/modules/attendance/**/*.spec.ts"` | Passed — 3 test files, 18 tests |
| `npx ng test --no-watch --include "src/app/layouts/**/*.spec.ts"` | Passed — 9 test files, 65 tests |
| `npm run build` | Passed — Angular application bundle generated successfully; no Angular errors and no Time Tracking stylesheet budget warning |
| `git diff --check` | Passed with exit code 0 |

The focused coverage includes API endpoint and payload assertions, Signal Store loading/mutation/toast/deduplication/error behavior, action-button visibility, break-zero helper text, missed-clock-in warning, humanized messages, covered-history permission visibility, route metadata, navigation path, and sidebar permission combinations.

## Skipped Checks

No backend tests were run because the requested scope explicitly prohibits backend edits and the deliverable is frontend-only. No live authenticated browser/API test was run because it would require a tenant session and a running backend environment. No People-list attendance indicator test was added because that feature is intentionally deferred until its data contract exists.

## Remaining Risks

The page assumes the backend continues to serialize the documented DTO property names in the application’s current camel-case JSON convention. Date and time display uses the browser locale; the backend `timezone` is shown as context, while `DateTimeOffset` values are formatted in the user’s browser timezone. The covered-history UI does not provide an employee filter because the existing frontend has no employee selector contract in this scope; the optional service parameter is implemented and tested for future use. Final end-to-end validation should be performed against a tenant-authenticated backend with representative schedule, policy, break, holiday, and permission responses.

## Verification and Repository State

The initial branch was `feature/employee-management-phase1-foundation` with a clean working tree before implementation. The final changes remain uncommitted and unpushed, as requested. Temporary verification logs were removed from the repository.
