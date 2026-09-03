# Time Tracking Frontend Part 1A — Leave-Aware Attendance Status

## Scope and outcome

The frontend-only integration for leave-aware attendance status, non-working-day messaging, backend-provided attention labels, and break overage is complete in `C:\onevoNew\Hrms--Web-application---front-end---v1`. The implementation consumes the backend response fields directly and does not calculate attendance status, leave status, holiday status, or break overage in the browser.

The existing Time Tracking endpoints and action controls were preserved. Clock-in, clock-out, start-break, and end-break visibility continues to be controlled solely by the backend boolean fields. No Attendance Corrections, Work-area Change Requests, People → Employees list changes, additional attendance requests, or backend changes were made.

## Files changed

| File | Change |
|---|---|
| `src/app/modules/attendance/models/time-tracking.model.ts` | Added optional nullable/status fields to Today and History contracts while retaining every existing field and backend property name. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` | Added backend-label precedence, severity-class mapping, attention detection, friendly break-overage labels, and duplicate-message suppression. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html` | Updated Today status rendering, attention banner, break card, personal history, and covered/team history rendering. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.css` | Added compact token-based neutral, warning, critical, and overage styles. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts` | Added component coverage for label precedence, attention severity, duplicate warning suppression, non-working-day clock-in visibility, break overage, and personal/team history parity. |
| `src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts` | Added Today and History response-contract preservation tests while retaining endpoint and request-shape coverage. |
| `src/app/modules/attendance/state/time-tracking.store.spec.ts` | Added assertions that expanded Today fields pass through state loading unchanged. |

The production API service and signal store were inspected and intentionally left unchanged because they already use typed `HttpClient` pass-through responses and do not derive attendance status. No frontend file outside the requested Time Tracking area was modified.

## Backend DTO fields used

The frontend now accepts and displays the following backend-provided fields without renaming them:

| Response | Fields |
|---|---|
| `AttendanceTodayResponse` | `attendanceStatusLabel`, `attentionType`, `attentionLabel`, `attentionSeverity`, `breakOverageMinutes`, `isOverBreakAllowance` |
| `AttendanceHistoryRow` | `statusLabel`, `attentionType`, `attentionLabel`, `attentionSeverity`, `breakOverageMinutes`, `isOverBreakAllowance` |

The fields were verified directly against the backend response records and the shared status resolver rather than relying only on the backend reports. The backend contract appends these fields while retaining the existing response prefix and action booleans.[1] [2]

## UI behavior implemented

### Today card and attention area

The Today status pill and the Self service action state use `attendanceStatusLabel` when it is present and non-blank. When the label is null, blank, or absent for backward compatibility, the existing humanized `attendanceStatus` fallback is used.

When `attentionLabel` is present, the page renders it once in a friendly attention banner and does not render `attentionType`. `critical` and `error` severities use the danger token styling, `warning` uses the warning token styling, and `info`, `neutral`, null, or unknown values use a neutral token style. When there is no backend attention label, the existing “You have not clocked in yet.” message is shown only when `shouldHaveClockedIn` is true. This prevents duplicate or contradictory warnings for approved time off and non-working days.

The existing friendly Today message behavior remains in place. A backend attention label is filtered out of the friendly message list when the same text would otherwise be shown twice. Technical machine values continue to be suppressed unless the backend has already supplied a user-facing label.

### Break overage

When `isOverBreakAllowance` is true or `breakOverageMinutes` is greater than zero, the Break time card displays “Break time exceeded by {X} min.” and continues to show the actual used break duration. The remaining value is never recalculated into a negative number, no break is auto-closed, and the End break action remains visible whenever the backend sets `canEndBreak` to true. If the allowance is exhausted without overage, the prior muted/light card and helper text behavior remains unchanged.

### Personal and covered history

Both personal history and covered/team history use `statusLabel` before falling back to the current humanized `status` value. A non-empty `attentionLabel` is displayed as a secondary line, and overage rows display “Break exceeded by {X} min”. Raw values such as `worked_during_time_off`, `non_working_day`, `break_overage`, `not_clocked_in`, and `attendance:read` are not rendered by the new UI.

The existing covered-history permission and visibility behavior is unchanged. No new permission gate or employee endpoint was introduced.

### Timezone behavior

The existing timezone correction is preserved. Today timestamps use `Today.timezone`, personal and covered history timestamps use the loaded Today timezone, and the component uses explicit UTC as the fallback before Today is loaded. Browser timezone is not used as a silent source of truth.

## Tests run

| Check | Result |
|---|---|
| `npx ng test --no-watch --include src/app/modules/attendance/**/*.spec.ts` | Passed: 3 test files, 29 tests passed. |
| `npm run build` | Passed: production build completed successfully. Existing Angular/CommonJS and unused-import warnings were emitted outside this change and did not fail the build. |
| `git diff --check -- src/app/modules/attendance` | Passed with no whitespace-error output. Git emitted only the existing LF-to-CRLF worktree advisory messages. |
| `git status --short --untracked-files=all` | Confirmed seven intended modified frontend files and no untracked report/log artifacts before report creation. |

The focused component suite was also run during implementation after the new template behavior was added; the final full attendance-module run passed all 29 tests.

## Skipped or partially completed checks

The initial repository-wide `git diff --check` emitted a real trailing-blank-line error in the newly appended stylesheet; that blank line was removed. A subsequent unscoped scan emitted only line-ending advisories but exceeded the timeout of the mounted Windows worktree while Git was continuing its diff scan. The scoped attendance-module check completed successfully and is the verification result recorded above.

No backend build or backend test command was run because the plan explicitly limited work to the frontend repository. The backend verification report records an existing .NET/NuGet restore blocker, so backend runtime verification remains outside this frontend task.[3]

## Remaining risks

The backend implementation reports that public-holiday awareness remains deferred because no authoritative holiday source is currently connected; the frontend therefore consumes `isHoliday`, `holidayName`, and the status fields exactly as returned and does not infer holiday behavior.[4]

The backend report also notes that complete backend build, EF translation, exact serialization, and integration verification remain blocked by the attached Windows .NET/NuGet environment. Frontend tests validate TypeScript acceptance, pass-through behavior, rendering, and endpoint preservation, but they cannot prove backend runtime serialization or database-side status resolution.[3]

The response fields are optional in the frontend interfaces to preserve compatibility with older responses while accepting the nullable backend contract. Once the backend contract is fully deployed, the same fields will be consumed without a mapping layer or browser-side status derivation.

## Boundary confirmations

> **Backend not touched:** Confirmed. All changes are under `C:\onevoNew\Hrms--Web-application---front-end---v1`; `C:\onevoNew\HRMS-Backend-v1` was read for contract inspection only.

> **No commit or push performed:** Confirmed. The frontend branch remained `feature/employee-management-phase1-foundation`, and all implementation changes remain unstaged.

> **No extra API calls:** Confirmed. The existing Time Tracking API surface remains limited to Today, personal history, covered history, and the existing attendance mutations. No People employee endpoint or per-employee attendance request was added.

## References

[1]: `../HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs` — Backend Today and History response records.
[2]: `../HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Services/AttendanceDayStatusResolver.cs` — Backend status, label, attention, and break-overage resolution.
[3]: `../HRMS-Backend-v1/ATTENDANCE_STATUS_LEAVE_AWARENESS_BACKEND_PART1_VERIFICATION_REPORT.md` — Backend verification status and environment limitations.
[4]: `../HRMS-Backend-v1/ATTENDANCE_STATUS_LEAVE_AWARENESS_BACKEND_PART1_REPORT.md` — Backend Part 1 scope, response fields, and holiday-awareness boundary.
[5]: `../ONEVO_HRMS_Frontend_Architecture.md` — Frontend layering, typed API contracts, state, and testing guidance.
