# Time Tracking Frontend Part 1B — Employee List Attention Report

## Scope and repository boundary

This implementation wires the backend-provided employee-list attendance summary into **People → Employees** in the frontend repository only:

`C:\onevoNew\Hrms--Web-application---front-end---v1`

The employee list continues to use the existing `GET /api/v1/employees` request. No frontend attendance or time-tracking request was added, and no attendance status is calculated in the browser. The store and feature page continue to pass the backend response through unchanged, preserving backend ordering and pagination.

The backend repository was not touched. No files were staged, committed, or pushed.

## Files changed

| File | Change |
|---|---|
| `src/app/modules/people/models/employee.model.ts` | Extended `EmployeeListAttendanceSummaryResponse` with the backend status, attention, and break-overage fields. |
| `src/app/modules/people/ui/employee-table/employee-table.component.ts` | Added null-safe presentation helpers for warning-label priority, attention severity classes, attendance-status labels, and backend-provided break overage. |
| `src/app/modules/people/ui/employee-table/employee-table.component.html` | Added warning-label priority, generic attention indicators, attendance-status labels, accessible break-overage markers, and preserved HR status-dot rendering. |
| `src/app/modules/people/ui/employee-table/employee-table.component.css` | Added semantic severity styles using central theme tokens and converted attendance warning/status visuals to theme tokens. |
| `src/app/modules/people/ui/employee-table/employee-table.component.spec.ts` | Added coverage for warning-label priority and fallback, raw machine-value suppression, severity classes, break-overage de-duplication, and null handling. |
| `src/app/modules/people/data-access/people-api.service.spec.ts` | Expanded employee-list contract coverage to preserve every attendance-summary field and `attendanceSummary: null`. |
| `TIME_TRACKING_FRONTEND_PART1B_EMPLOYEE_LIST_ATTENTION_REPORT.md` | This report. |

The People store, employee-list feature component, and page template required no behavior changes. Their existing pass-through behavior is the desired implementation for backend ordering, pagination, and no-N+1 request safety.

## Backend DTO fields used

The frontend model now includes the complete verified `EmployeeListAttendanceSummaryResponse` contract from the backend DTO at `HRMS-Backend-v1/src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/EmployeeListItemResponse.cs`:

| Field | Frontend type | Usage |
|---|---|---|
| `showNotClockedInWarning` | `boolean` | Controls the warning ring and warning tooltip. |
| `shouldHaveClockedIn` | `boolean` | Preserved in the API model; no frontend calculation. |
| `hasClockedInToday` | `boolean` | Preserved in the API model; no frontend calculation. |
| `workDate` | `string` | Preserved in the API model. |
| `timezone` | `string` | Preserved in the API model. |
| `scheduledStartTime` | `string \| null` | Preserved in the API model. |
| `warningLabel` | `string \| null` | First priority for warning tooltip and accessible label. |
| `attendanceStatus` | `string \| null` | Preserved as machine-readable backend data and never rendered directly. |
| `attendanceStatusLabel` | `string \| null` | Rendered as a friendly compact attendance-status label. |
| `attentionType` | `string \| null` | Preserved as backend data and never rendered directly. |
| `attentionSeverity` | `string \| null` | Maps `critical`/`error` to critical styling, `warning` to warning styling, and all other values to neutral styling. |
| `attentionLabel` | `string \| null` | Rendered for generic attention when the not-clocked-in warning ring is not active. |
| `breakUsedMinutes` | `number` | Preserved in the API model; no frontend calculation. |
| `breakAllowanceMinutes` | `number \| null` | Preserved in the API model; no frontend calculation. |
| `breakOverageMinutes` | `number` | Used directly to render the break-overage marker. |
| `isOverBreakAllowance` | `boolean` | Participates in the backend-result presence check; overage text still uses `breakOverageMinutes`. |

The fields that are optional in the TypeScript interface remain backward-compatible with existing fixtures and older responses, while nullable backend values are handled without rendering technical placeholders.

## UI behavior implemented

When `showNotClockedInWarning === true`, the employee remains in its backend-provided row position and receives the existing red avatar ring. The avatar wrapper remains keyboard focusable and exposes friendly accessible text. Tooltip and accessibility text use `warningLabel` first, then `attentionLabel`, and finally the fallback **“Still has not clocked in.”** Raw values such as `attentionType` are never displayed.

When `showNotClockedInWarning` is false and a trimmed `attentionLabel` exists, the table renders the friendly label in the employee identity area. Severity styling is semantic: `critical` and `error` use danger tokens, `warning` uses warning tokens, and `info`, `neutral`, null, or unknown values use neutral tokens. The employee HR status dot remains derived solely from `employee.status`.

When the backend reports a positive `breakOverageMinutes`, or marks `isOverBreakAllowance` true with a positive backend overage value, the row displays **“Break exceeded by {n} min.”** The frontend does not derive the value. If the friendly `attentionLabel` already describes break overage, the separate marker is suppressed to avoid duplicate visible text. The marker has title text for accessible hover/focus context.

When `attendanceStatusLabel` exists, it is shown in the same compact identity attention area. It does not replace the employee HR status or status dot. If the attendance summary is null, or its individual nullable labels are absent, the row remains free of warning, attention, break, undefined, null, and raw machine-value badges.

No frontend sorting or row movement was introduced. The `@for` loop continues to render `employees()` directly in the order returned by the backend. No per-employee attendance endpoint is called.

## Tests run

| Check | Result |
|---|---|
| `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts` | **Passed — 315 tests passed, 0 failed.** |
| `npm run build` | **Passed — Angular production build completed and returned to the shell without build errors.** |
| `git diff --check` on changed People files | **Passed — no whitespace errors were reported.** Git emitted only existing LF-to-CRLF advisory messages for the Windows worktree. |
| `git status --short --branch` | Confirmed branch `feature/employee-management-phase1-foundation`; the worktree also contained pre-existing unrelated attendance changes. |

The focused People suite includes existing page-level assertions that the Employees screen uses the `/employees` response directly and does not issue `/attendance` or `/time-tracking` requests. The new table and API assertions cover the Part 1B behavior described above.

## Skipped checks

No backend build or backend test was run because the requested scope explicitly prohibited backend changes. No browser or end-to-end verification was run. No full-repository frontend test suite outside the People module was run. No separate model test file exists for this interface, and the People store behavior did not change, so neither was modified.

## Remaining risks

The implementation is verified against the local Angular test and build configuration but was not exercised against a live serialized API response or a browser session. The frontend intentionally trusts backend-provided attendance semantics, labels, severity, ordering, and pagination; a backend contract regression would therefore require API-contract or integration verification. The severity mapping fails safely to neutral styling for unknown values, and nullable or missing summary fields fail closed without exposing technical values.

The break marker requires a positive backend `breakOverageMinutes` to produce the numeric text. This avoids rendering an undefined or misleading number if a backend response sets `isOverBreakAllowance` without supplying a usable overage value.

## Final confirmations

| Confirmation | Status |
|---|---|
| Backend repository touched | **No** |
| Backend files changed | **No** |
| Per-employee attendance requests added | **No** |
| Frontend sorting added | **No** |
| Employees hidden when summary is null | **No** |
| Files staged | **No** |
| Commit created | **No** |
| Push performed | **No** |

## References

[1]: `HRMS-Backend-v1/src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/EmployeeListItemResponse.cs` — Verified employee-list response DTO and attendance-summary fields.

[2]: `HRMS-Backend-v1/TIME_TRACKING_BACKEND_PART5_EMPLOYEE_LIST_WARNING_REPORT.md` — Backend employee-list warning, ordering, pagination, and permission contract.

[3]: `HRMS-Backend-v1/ATTENDANCE_STATUS_LEAVE_AWARENESS_BACKEND_PART1_REPORT.md` — Backend attendance status, attention, and break-overage semantics.

[4]: `src/app/shared/styles/theme-tokens.css` — Central frontend semantic color tokens used by the updated table styles.
