**Date:** 2026-08-24  
**Scope:** Attendance correction response timezone consumption and Attendance route regression coverage  
**Repository:** `Hrms--Web-application---front-end---v1`

## Summary

The remaining frontend defect was limited to the employee-facing **My correction requests** table. The approval inbox already formatted correction timestamps using each response’s `request.timezone`, but the employee table’s `correctionSummary(request)` used the page-level `displayTimezone()`. The reviewed timestamp in the same table also used `displayTimezone()`. This could show historical correction instants in the currently selected legal entity’s timezone rather than the authoritative timezone returned with the correction response.

The employee correction-history call sites now use `request.timezone` for requested clock-in, requested clock-out, and reviewed timestamps. The existing safe formatter remains responsible for invalid timezone and missing timestamp handling. Today and attendance-history fields continue to use `displayTimezone()` where their contract is tied to the currently loaded Today/legal-entity context. No browser-timezone fallback, raw timezone identifier, endpoint, request payload, or approval workflow change was introduced.

## Exact defect and corrected call sites

| Location | Previous behavior | Corrected behavior |
|---|---|---|
| `time-tracking.component.ts` — `correctionSummary(request)` requested clock-in | Passed `this.displayTimezone()` | Passes `request.timezone` |
| `time-tracking.component.ts` — `correctionSummary(request)` requested clock-out | Passed `this.displayTimezone()` | Passes `request.timezone` |
| `time-tracking.component.html` — reviewed timestamp | Passed `displayTimezone()` | Passes `request.timezone` |
| `correction-approvals.component.ts` — approval inbox summaries | Already used `request.timezone` | No change required; existing behavior retained |
| Today and attendance-history formatting | Uses page/Today timezone by contract | No global replacement; existing behavior retained |

For break corrections, the employee table displays the number of requested intervals rather than the individual break instants, so there was no employee-table break timestamp call site to change. The approval inbox’s existing break interval formatter already supplies the correction response timezone and remains covered by its focused tests.

## Route regression coverage

A focused `src/app/modules/attendance/attendance.routes.spec.ts` now tests the actual `ATTENDANCE_ROUTES` configuration. The tests prove that `/attendance/time-tracking` retains `permissionGuard`, the `time_attendance` module gate, and the any-of permission set `attendance:read-own`, `attendance:write-own`, or `attendance:read`. They also prove that `/attendance/corrections/approvals` retains `permissionGuard`, the `time_attendance` module gate, and `attendance:approve` without role-name checks.

The same spec verifies both protected destinations remain lazy-loaded, the self-service route does not require `attendance:approve`, the protected routes are not unguarded, and the empty-path redirect remains `time-tracking` with `pathMatch: 'full'`. The permission list is asserted as an any-of contract and was not converted into an all-of requirement.

## Files changed for this fix

| File | Change |
|---|---|
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` | Changed correction-summary clock-in and clock-out formatting to use `request.timezone`. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html` | Changed reviewed correction timestamp formatting to use `request.timezone`. |
| `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts` | Added deterministic Asia/Colombo versus America/New_York tests for requested times, reviewed time, invalid correction timezone, and null correction timestamps. |
| `src/app/modules/attendance/attendance.routes.spec.ts` | Added three route-contract tests for guards, module/permission gates, role-name absence, self-service permission boundaries, and redirects. |

## Tests and verification run

| Check | Result |
|---|---|
| `npx ng test --no-watch --include src/app/modules/attendance/**/*.spec.ts` | Passed: **5 test files, 49 tests**. |
| `npm run build` | Passed. Angular reported existing non-blocking diagnostics and style-budget/CommonJS warnings; no build errors. |
| `git diff --check` | Passed for the frontend working tree with no whitespace errors. |

The 49-test focused run includes the 21 time-tracking component tests, 6 correction-approval component tests, 5 store tests, 14 data-access tests, and 3 new Attendance route-contract tests. The correction-history assertions use `Asia/Colombo` while Today/page context uses `America/New_York`, so they do not depend on the developer machine’s browser timezone. They also assert that invalid correction timezones do not throw, null timestamps render safely, and raw technical timezone/error text is not exposed.

## Skipped live-browser checks

No live browser or deployed-environment check was run. The requested verification was source-level Angular testing and production build validation; no browser session or staging URL was supplied. The complete frontend test suite outside the Attendance module was not run. Existing Angular warnings, including optional-chain diagnostics and unrelated component style-budget/CommonJS notices, were not changed because they are outside this correction fix.

## Remaining risks

The frontend depends on the backend response continuing to provide the authoritative `timezone` field for every `AttendanceCorrectionResponse`. The formatter explicitly validates the supplied identifier and renders the existing safe fallback rather than falling back silently to the browser timezone. Live API rendering should still be smoke-tested after the backend migration is applied and deployed.

## Final status

The employee correction-history table now uses each correction response’s backend-provided timezone for every displayed correction-specific instant. Route regression coverage confirms the Attendance module remains protected with the intended any-of permission semantics and no invented role or permission checks. Frontend verification completed with **49 focused tests**, **5 test files**, a successful production build, and a successful whitespace check.

**No commit or push was performed.**
