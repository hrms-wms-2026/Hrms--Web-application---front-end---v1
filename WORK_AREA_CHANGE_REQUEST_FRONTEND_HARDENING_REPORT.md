# ONEVO HRMS — Work Area Change Request Frontend Hardening Report

**Date:** 26 August 2026  
**Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
**Branch:** `feature/employee-management-phase1-foundation`

## Executive summary

The requested frontend hardening work was completed in the frontend repository only. Two historical test failures were stale expectations rather than production defects: the application-route test searched for Attendance at the top level even though it is nested under the authenticated `MainLayoutComponent` shell, and the Clock-in Policy test expected a subtitle intentionally removed from the current single-screen design. Both tests were corrected without changing production routing or restoring removed Clock-in Policy UI.

The Work Area approval deep-link flow now makes only the existing pending-page request. A matching pending request opens for review; an ID absent from that loaded page produces the neutral message `Open the pending requests list to review this request.` The frontend no longer claims that an absent request is approved, rejected, cancelled, or otherwise no longer awaiting review. No page loop and no invented get-by-ID endpoint were added. Work Area status labels now use the single fallback `Request status unavailable` for null, blank, and unknown machine values.

The focused corrected suites, attendance suite, complete frontend suite, production build, and whitespace-equivalent diff check all completed successfully. The exact `git diff --check` invocation emitted only Git line-ending conversion notices but did not return within the attached shell timeout; the equivalent `git --no-pager diff --check` completed with exit code 0 and reported no whitespace errors.

## Initial repository status

Before edits, the required command was run:

```text
git status --short --branch
```

The initial branch was `feature/employee-management-phase1-foundation`. The working tree was already non-clean, with tracked modifications in notification services and navigation, attendance routes and API files, and Time Tracking files, plus untracked Work Area model, approval-feature, and report files. Those unrelated changes were not reverted, reformatted, staged, committed, or pushed. No backend repository was accessed for modification.

## Corrections implemented

| Area | Root cause | Correction |
|---|---|---|
| Application route test | The test searched `routes` directly for `attendance` and `time-attendance`, but both routes are children of the authenticated shell. | The test locates the shell structurally by `path === ''`, `authGuard`, and `children`, then verifies the nested Attendance and legacy redirect routes. |
| Clock-in Policy test | The test still expected the removed subtitle `Control how employees can clock in for this company.` | The test was renamed and now verifies the current company-wide form, save action, four method cards, Late deduction rules, no table/list view, and absence of removed metadata and subtitle. |
| Work Area deep link | After loading the pending inbox, the component searched that same pending-only collection for a non-pending `staleMatch` and could claim `This request is no longer waiting for approval.` without backend evidence. | The stale-status branch was removed. Missing-on-current-page requests receive only the neutral message `Open the pending requests list to review this request.` |
| Work Area scroll lookup | The deep-link row scroll used `CSS.escape`, which is unavailable in the test DOM and caused an unhandled timer error. | The row is located by the already-rendered `data-request-id` elements and a dataset equality check, preserving the scroll behavior without relying on `CSS.escape`. |
| Work Area status fallback | Null/blank status returned `Unknown status`, while unknown non-null status returned `Request status unavailable`. | All unsupported values now resolve through the same `Request status unavailable` fallback; known statuses retain their friendly labels. |

## Real route structure

The production route structure is unchanged. The authenticated shell is a top-level route with `path: ''`, `MainLayoutComponent`, `authGuard`, and a `children` array. Within those children:

- `attendance` is lazy-loaded through `loadChildren`, protected by `permissionGuard`, requires the `time_attendance` module, and retains `attendance:read-own`, `attendance:write-own`, and `attendance:read` permissions.
- `time-attendance` remains a legacy child route redirecting to `attendance/time-tracking`.

Attendance was not moved to the top level, and production guards were not weakened or removed.

## Work Area deep-link behavior

The notification destination contract and URL remain unchanged:

```text
destinationKey: work_area_change_approval
workAreaChangeRequestId

/attendance/work-area-change-requests/approvals?requestId=...
```

The approval inbox performs one pending-page load. If the requested ID is present in that loaded page with status `pending`, the component opens that request for review and preserves the existing scroll-to-row behavior. If the requested ID is absent from the loaded pending page, the inbox remains visible and shows:

> Open the pending requests list to review this request.

The frontend does not infer a final status from absence in a pending page. Without a reviewer-safe backend get-by-ID contract, it cannot establish whether a request was approved, rejected, cancelled, or otherwise no longer pending. No additional API detail request and no unbounded page search were introduced.

## Safe fallback rules

| Input | Display value |
|---|---|
| `pending` | `Pending` |
| `approved` | `Approved` |
| `rejected` | `Rejected` |
| `cancelled` | `Cancelled` |
| Null status | `Request status unavailable` |
| Empty or whitespace status | `Request status unavailable` |
| Unknown machine status | `Request status unavailable` |
| `onsite` work area | `On-site` |
| `remote` work area | `Remote` |
| Unknown, null, or blank work area | `Work area unavailable` |

Raw backend status codes are never displayed by the status-label helper.

## Files changed by this task

### Production files

| File | Change |
|---|---|
| `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.ts` | Removed unsupported stale-status conclusion and made the deep-link row lookup safe in the test DOM. |
| `src/app/modules/attendance/models/work-area-change-request.model.ts` | Unified null, blank, and unknown status fallback behavior. |

### Test files

| File | Change |
|---|---|
| `src/app/app.routes.spec.ts` | Added structural lookup of the authenticated shell and nested Attendance/legacy-route assertions. |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts` | Replaced the stale subtitle expectation with current single-screen UI contract assertions. |
| `src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts` | Added matching deep-link, neutral missing-request, no-false-conclusion, and no-extra-lookup coverage. |
| `src/app/modules/attendance/models/work-area-change-request.model.spec.ts` | Added null, undefined, empty, whitespace, unknown, and known status-label cases. |

The report file itself was also updated with the verified results. Existing unrelated working-tree modifications observed at the start were left untouched.

## Verification results

| Command | Result |
|---|---|
| `npx ng test --no-watch --include src/app/app.routes.spec.ts --include src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts` before corrections | **Expected baseline failure:** 2 failing tests, one stale app-route assertion and one removed Clock-in Policy subtitle assertion. |
| `npx ng test --no-watch --include src/app/app.routes.spec.ts --include src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts --include src/app/modules/attendance/models/work-area-change-request.model.spec.ts --include src/app/modules/attendance/feature/work-area-approvals/work-area-approvals.component.spec.ts` | **Passed:** 4 test files, 64 tests. |
| `npx ng test --no-watch --include src/app/modules/attendance/**/*.spec.ts` | **Passed:** 7 test files, 108 tests. |
| `npx ng test --no-watch` | **Passed:** 195 test files, 1,494 tests. |
| `npm run build` | **Passed:** Angular production application bundle generation completed successfully. Existing Angular diagnostic and stylesheet warnings were emitted but did not fail the build. |
| `git diff --check` | Emitted only LF-to-CRLF conversion notices and did not return within the attached shell timeout. No whitespace error output was observed. |
| `git --no-pager diff --check` | **Passed:** exit code 0; no whitespace errors. |

The focused Work Area suite contains 18 direct component tests after the additions. The status model suite contains 20 tests, and the corrected app-route and Clock-in Policy specs pass with 4 and 22 tests respectively.

## Warnings and scope boundaries

The build continues to report existing Angular extended-diagnostic warnings, including optional/nullish expression warnings in existing Time Tracking and other module templates, plus existing stylesheet warning thresholds. These warnings were not expanded into unrelated cleanup because they do not block the requested behavior or build.

The browser/E2E suite, live backend integration, staging response-header smoke test, and manual accessibility audit were not requested as local verification gates. No backend contract was simulated or extended.

## Final safety confirmations

No backend files were modified. The backend repository was not changed. Nothing was staged, committed, or pushed. Temporary test-output logs created during diagnosis were removed from the frontend working tree. All implementation and test changes remain unstaged for user review.
