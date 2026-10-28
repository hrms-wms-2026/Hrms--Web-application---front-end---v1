# Time Tracking Frontend Part 2 — Employee List Warning

## Status

The People → Employees frontend employee-list attendance-warning implementation remains correct under its focused tests. The requested final People-suite failure was investigated and proven to be unrelated to the employee-list warning changes. No checklist-template code, legal-entity store code, backend code, or employee-list warning code was changed during this diagnostic pass.

The work remained limited to:

```text
C:\onevoNew\Hrms--Web-application---front-end---v1
```

No files were staged, committed, or pushed.

## Exact failing test and assertion

The required command was rerun:

```text
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
```

It reproduced one failure and 308 passing tests across 39 People spec files.

| Item | Exact result |
|---|---|
| Failing spec | `src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts` |
| Describe path | `ChecklistTemplatesComponent - real selectedLegalEntity chain (no request loop)` |
| Test | `idle change detection after a real company load does not re-trigger the list call` |
| Assertion location | `checklist-templates.component.no-loop.spec.ts:39:8` |
| Assertion | `httpMock.expectOne((r) => r.url === \`${environment.apiUrl}/org/legal-entities\`)` |
| Actual request received | `GET https://localhost:7229/api/v1/session/companies` |
| Final suite result | 38 files passed, 1 file failed; 308 tests passed, 1 test failed |

The failing test fails before it reaches its checklist-template request-loop assertion. It calls `legalEntityStore.loadCompanies()`, then expects the wrong company-list URL. The failure is therefore an endpoint-contract mismatch in the checklist-template test setup, not a rendering, ordering, model, API, or attendance-warning failure.

## Root cause

The failing test uses the real `LegalEntityStore`. Its current `loadCompanies()` implementation calls `api.getAccessibleCompanies()` and therefore uses the session-scoped company selector endpoint:

```typescript
const companies = await firstValueFrom(api.getAccessibleCompanies());
```

The organization API service maps that method to `GET /session/companies`. The separate `getLegalEntities()` method maps to `GET /org/legal-entities`, which is the management/read endpoint used for organization administration rather than the session-scoped company selector.

The failing test at line 39 expects `/org/legal-entities`, while the actual store request is `/session/companies`. Existing `LegalEntityStore` tests independently assert the session-scoped contract, including the test at `src/app/modules/organization/state/legal-entity.store.spec.ts:54-58`:

```typescript
const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
```

The employee-list warning implementation does not import, call, or modify `LegalEntityStore`, `LegalEntityApiService`, `ChecklistTemplatesComponent`, or the failing checklist-template spec. The failure does not involve `attendanceSummary`, `showNotClockedInWarning`, avatar rendering, employee-list pagination, or employee-list HTTP requests.

## Proof that the failure is unrelated and pre-existing

A clean-HEAD comparison was performed using a binary-safe Git archive of `HEAD`. The comparison snapshot excluded the uncommitted employee-list warning changes. The exact failing checklist-template spec was then run from that clean snapshot with the same Angular test command.

The clean-HEAD run reproduced the same failure:

| Comparison | Result |
|---|---|
| Snapshot | `git archive HEAD`, with the employee-list warning working-tree changes absent |
| Spec executed | `src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts` |
| Same failing test | `idle change detection after a real company load does not re-trigger the list call` |
| Same assertion | `checklist-templates.component.no-loop.spec.ts:39:8` expecting `/org/legal-entities` |
| Same actual request | `GET https://localhost:7229/api/v1/session/companies` |
| Clean-HEAD result | 1 test failed, 1 test failed |

This is a direct reproduction without the employee-list warning changes. It proves that the warning implementation did not introduce the failure.

The failing spec itself and the legal-entity store were also checked with `git diff --name-only`; neither file is changed by the warning implementation. The initial status captured before this diagnostic run likewise showed the existing warning implementation changes and unrelated worktree changes, but not the failing checklist-template spec or the legal-entity store. The failure is therefore present in the established checklist/organization test contract independently of this task.

The employee-list warning-specific tests remain green. The prior focused run covering the employee table, employee-list container, People API service, and People store passed all 46 tests. The full-suite failure is isolated to the checklist-template no-loop test and does not fail any employee-list warning test.

## Fix decision

No checklist-template or legal-entity code was changed. Changing the store from `/session/companies` to `/org/legal-entities` would contradict the existing session-scoped company-selector implementation and its own tests. Changing the failing test to expect `/session/companies` may be a valid separate checklist/organization maintenance task, but it was not changed here because the user explicitly asked to avoid altering checklist behavior unless the test’s contract was separately reviewed and corrected.

No warning test was weakened or deleted. The employee-list warning implementation continues to use the backend-provided flag only:

```typescript
employee.attendanceSummary?.showNotClockedInWarning === true
```

## Employee-list warning behavior confirmed

The frontend employee model includes the nullable backend `attendanceSummary` contract from `GET /api/v1/employees`. The table renders the existing employee row normally and conditionally adds a red circular avatar ring, keyboard focusability, accessible label, native title, and friendly tooltip only when `showNotClockedInWarning` is exactly `true`.

Null, absent, and false attendance summaries render the normal avatar without a warning ring or tooltip. The frontend does not calculate clock-in status, use browser timezone data, call attendance endpoints per employee, add permission assumptions, or reorder the server-paginated list. The People store and table preserve the backend-provided item order.

## Files changed or preserved

This diagnostic pass updated only the requested report:

| File | Diagnostic-pass result |
|---|---|
| `TIME_TRACKING_FRONTEND_PART2_EMPLOYEE_LIST_WARNING_REPORT.md` | Updated with the exact failure, root cause, clean-HEAD proof, and final verification results. |
| `src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts` | Not changed. |
| `src/app/modules/organization/state/legal-entity.store.ts` | Not changed. |
| Backend workspace/files | Not touched. |

The existing employee-list warning implementation changes were preserved in these frontend files and were not modified during this diagnostic pass:

| File | Existing implementation role |
|---|---|
| `src/app/modules/people/models/employee.model.ts` | Nullable `attendanceSummary` model contract. |
| `src/app/modules/people/ui/employee-table/employee-table.component.html` | Conditional warning ring, focus attributes, title, and friendly tooltip markup. |
| `src/app/modules/people/ui/employee-table/employee-table.component.css` | Red circular ring, focus outline, and hover/focus tooltip styles. |
| `src/app/modules/people/ui/employee-table/employee-table.component.spec.ts` | Warning, null, false, tooltip, accessibility, and order coverage. |
| `src/app/modules/people/data-access/people-api.service.spec.ts` | Backend summary preservation coverage. |
| `src/app/modules/people/state/people.store.spec.ts` | Backend order preservation coverage. |
| `src/app/modules/people/feature/employee-list/employee-list.component.spec.ts` | No per-employee attendance-request and list-order coverage. |

Temporary diagnostic logs and the clean comparison snapshot were removed after verification.

## Final verification results

| Command or check | Result |
|---|---|
| `git status --short --branch` before diagnosis | Passed; branch was `feature/employee-management-phase1-foundation`. Existing unrelated and implementation worktree changes were preserved. |
| Required People suite | **308 passed, 1 failed**. The single failure is the unrelated checklist-template endpoint assertion described above. |
| Clean-HEAD failing-spec reproduction | **Reproduced the same one-test failure** without employee-list warning changes. |
| Focused employee-list warning specs | **46 passed** across 4 modified-feature spec files. |
| `npm run build` | **Passed**, exit code 0. Existing Angular diagnostics, style-budget, and CommonJS warnings remain outside this issue. |
| `git diff --check` | **Passed**, exit code 0. No whitespace errors were reported. |
| Backend build/tests | Not run because backend was explicitly out of scope. Backend files were not touched. |
| Commit/push | None performed. |

## Remaining risks

The full People suite will remain red until the separate checklist-template test is aligned with the established `LegalEntityStore.loadCompanies()` contract. The test currently expects an organization-management URL while the real store intentionally requests the session-scoped accessible-company URL. That maintenance change should be handled as a separate checklist/organization task with its own review.

The employee-list warning tooltip was verified through Angular component DOM/accessibility tests and a successful production build, but no browser-level visual regression was run. A staging browser check may still be useful to confirm tooltip placement at narrow viewport widths.

## Safety confirmations

Only the frontend workspace was used. No backend files were changed. No checklist behavior was changed. No useful tests were deleted or weakened. No new frontend permission assumption or per-employee attendance request was introduced. No files were staged, committed, or pushed.

## References

[1]: `../HRMS-Backend-v1/TIME_TRACKING_BACKEND_PART5_EMPLOYEE_LIST_WARNING_REPORT.md` — backend employee-list attendance-summary contract and server-side ordering/security behavior.

[2]: `src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts` — exact failing checklist-template test and `/org/legal-entities` assertion.

[3]: `src/app/modules/people/feature/checklist-templates/checklist-templates.component.ts` — checklist component’s real selected-company dependency.

[4]: `src/app/modules/organization/state/legal-entity.store.ts` — `loadCompanies()` implementation that calls `getAccessibleCompanies()`.

[5]: `src/app/modules/organization/state/legal-entity.store.spec.ts` — existing tests asserting `GET /session/companies` for `loadCompanies()`.

[6]: `src/app/modules/people/models/employee.model.ts` — frontend employee-list attendance-summary model.

[7]: `src/app/modules/people/ui/employee-table/employee-table.component.html` — employee avatar warning rendering.

[8]: `src/app/modules/people/ui/employee-table/employee-table.component.spec.ts` — focused warning-ring, tooltip, null/false, and order tests.
