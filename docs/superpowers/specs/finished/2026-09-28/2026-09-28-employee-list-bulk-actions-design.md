# Employee List Redesign + Bulk Actions (Sub-project B) — Design

**Date:** 2026-09-28
**Status:** Approved in conversation (backend section reviewed; frontend sections use defaults agreed in Q&A, user asked to proceed straight to plan)
**Repos:** HRMS-Backend-v1 (branch `feature/task-subtasks`) and Hrms--Web-application---front-end---v1 (branch `feature/task-subtasks`)
**Depends on:** Sub-project A (`SelectionModel`, `<app-dropdown-menu>`, `<app-bulk-action-bar>`) — shipped.

## Decisions (from Q&A)

1. Bulk actions in scope: **Change Position** (Promotion/Transfer), **Change Employment Type**, **Export Selected** (CSV), **Bulk Start Offboarding**. Out of scope: Change Reporting Manager, Change Department, Add to Group (no domain support; manager derives from position holders, department has no write path).
2. Fix the two permission gaps found:
   - Detail screen shows the Offboarding menu item on `employees:write`; backend requires `employees:offboard`. Gate it on `employees:offboard`.
   - `POST /employees/{id}/change-position` and `PUT /employees/{id}/job-details` have **no visibility-scope check**. Add one (403 when the target is outside the caller's scope; `org:manage` = unrestricted), same resolution the detail screen uses.
3. Bulk execution: **backend bulk endpoints, per-item partial success**, max 100 ids, each item dispatched through the existing single-item command via MediatR (precedent: `BulkApproveLeaveRequestsCommandHandler`), so every single-item rule applies unchanged.
4. Employee list: **delete all three views** (`employee-table`, `employee-list-view`, `employee-card-view`) and the view-cycle button. Replace with one table styled like the backlog's `app-task-table` (grey rounded header, card rows, accent-tinted selected rows, left checkbox column).
5. Columns: **existing list fields only**, no Phone/Location/Date of Joining. Default visible: Employee, ID, Position, Department, Employment Type, Reporting Manager. Optional: Company, Work Mode, Email, Status.
6. `employees:read:sensitive` guards only bank details — not relevant here.

## Backend

### B1. Manage-scope guard
- New `IEmployeeManageScopeGuard` (Application, `Features/CoreHr/Employee/ServiceInterfaces`): `Task<Result?> EnsureCanManage(Guid tenantId, Guid employeeId, CancellationToken ct = default)` → `null` when allowed, `Result.Forbidden("You do not have access to manage this employee.")` otherwise.
- Implementation (Infrastructure, `Services/CoreHr/EmployeeManageScopeGuard.cs`): `org:manage` → `EmployeeVisibilityScope.Unrestricted()`, else `IEmployeeVisibilityScopeResolver.ResolveAsync(tenantId, currentUser.UserId)`; then `IEmployeeRepository.GetVisibleByIdAsync(...)`; null → forbidden.
- Called in `ChangeEmployeePositionCommandHandler` and `UpdateEmployeeJobDetailsCommandHandler` immediately after the NotFound check, and in the new `ChangeEmployeeEmploymentTypeCommandHandler`. (Offboarding already has its own coverage guard.)

### B2. Narrow employment-type command
`ChangeEmployeeEmploymentTypeCommand(Guid EmployeeId, string EmploymentTypeCode) : IRequest<Result<Unit>>` — NotFound → scope guard → offboarding lock → code lookup (400 if unknown) → set `EmploymentTypeId` → save. Employee number and work mode untouched.

### B3. Bulk endpoints (EmployeesController)
| Route | Permission | Body | Per item dispatches |
|---|---|---|---|
| `POST /api/v1/employees/bulk/change-position` | `employees:write` | `{ employeeIds, positionId, effectiveFrom, changeReason, reportsToEmployeeId? }` | `ChangeEmployeePositionCommand` |
| `POST /api/v1/employees/bulk/employment-type` | `employees:write` | `{ employeeIds, employmentTypeCode }` | `ChangeEmployeeEmploymentTypeCommand` |
| `POST /api/v1/employees/bulk/offboarding/start` | `employees:offboard` | `{ employeeIds, reason, lastWorkingDate, knowledgeRiskLevel, rehireEligibility?, notes? }` | `StartOffboardingCommand` |

Response (200): `BulkEmployeeActionResponse { items: [{ employeeId, outcome: "succeeded"|"pendingApproval"|"failed", reason? }], succeeded, pendingApproval, failed }`.
- Validation (FluentValidation): ids non-empty, ≤ 100; duplicates de-duplicated.
- Isolation: after every item the bulk handler calls a new `IUnitOfWork.ClearTracking()` so a failed item's tracked-but-unsaved changes can never be flushed by a later item's `SaveChangesAsync`. Unexpected exceptions (not cancellation) become `failed` with a generic reason and are logged.
- Sequential processing (capacity checks see earlier items' writes).

### B4. List endpoint additions
`GET /employees` gains optional `positionId`, `employmentType` (repeatable codes), `managerId`, `sortBy` (`name|employeeNumber|position|department|employmentType|manager`; unknown → default), `sortDir` (`asc|desc`). Default ordering unchanged (attention priority then last name when attendance is included; last name otherwise). An explicit `sortBy` overrides attention-priority ordering. The list projection also fills `WorkModeLabel` (currently always null on the list path).

## Frontend

### F1. Table
New `modules/people/ui/employee-directory-table/` replacing the three deleted view components. Backlog visual language (copy `task-table` CSS tokens). Columns driven by a `visibleColumns` input; sortable headers emit `sortChanged`; checkbox column (header tri-state over visible rows); row click → `/people/employees/:id`; per-row `⋯` `<app-dropdown-menu>` with items supplied by the parent. Employee cell keeps avatar, status dot, name, number, and attendance/break warnings from the old table.

### F2. Column picker
`ui/employee-column-picker/` popover: searchable checkbox list, Employee column locked on, Reset (defaults) / Apply. Persisted per browser in `localStorage['employee_list_columns']` (try/catch; invalid → defaults).

### F3. Filter popover
`ui/employee-filter-popover/`: Department (`app-custom-select`, `DepartmentApiService.listFlat`), Position (`PositionApiService.listFlat`), Employment Type (checkboxes from a shared `EMPLOYMENT_TYPE_OPTIONS` constant), Reporting Manager (`app-custom-select` from `listEmployees({ pageSize: 100 })`). Sources use `LegalEntityStore.selectedLegalEntity()`. Staged edits; Apply writes URL params; Reset clears. Filter button shows active-filter count.

### F4. URL state
`search, page, pageSize (10|25|50, default 25), sortBy, sortDir, departmentId, positionId, employmentType (comma-joined), managerId`. Numbered pagination + page-size select. Selection clears on search/filter/sort/page-size change (not on page change).

### F5. Bulk bar (via `<app-bulk-action-bar noun="employee">`)
| Action | Placement | Shown when |
|---|---|---|
| Promote | primary | `employees:write` (disabled with reason when selection spans >1 company or has no company) |
| Transfer | primary | same as Promote |
| Change Employment Type | more | `employees:write` |
| Export Selected | more | always |
| Bulk Offboard | more, danger | `employees:offboard` |

- A row cache (`Map<id, EmployeeListItemResponse>`) keeps data for selected rows across pages (export, names in results, legal-entity check).
- Promote/Transfer reuse the existing `app-change-position-modal`, extended with a bulk mode (`employeeIds` input, `bulkCompleted` output). They require all selected employees to share one legal entity (the target position belongs to one); otherwise the actions are disabled with that reason as tooltip.
- After any bulk call: result modal ("N changed · N sent for approval · N skipped" + per-employee reasons), list reload, selection cleared.
- Export: client-side CSV of selected rows using currently visible columns; filename `employees-YYYY-MM-DD.csv`.

### F6. Row actions (`⋯`)
- Promote / Transfer: `employees:write` && not own record && `legalEntityId` && invitation not pending/expired && status not `resigned`/`terminated` → existing `app-change-position-modal`.
- Offboard: `employees:offboard` && not own record && status not `resigned`/`terminated` → navigate `/people/employees/:id/offboarding`.
- No items → no `⋯` button.

### F7. Detail screen fix
Offboarding menu item gated by `employees:offboard`; Promotion/Transfer items by `employees:write`; the menu renders when either applies (other existing conditions unchanged).

### Kept as-is
Onboarding Drafts tab (replaced in sub-project D), Add Employee button/wizard, search box.

## Testing
- Backend unit: scope guard (org:manage bypass, in-scope, out-of-scope); ChangePosition + UpdateJobDetails return 403 when guard forbids; ChangeEmploymentType handler; each bulk handler (mixed outcomes, pendingApproval mapping, exception → failed, ClearTracking per item, de-dup); validators (empty, >100); controller actions map to the right commands; list handler passes new filters/sort through.
- Backend integration (real Postgres): list filter by position / employment type / manager and sort by department desc; bulk change-position with one out-of-scope employee.
- Frontend (Vitest): directory table (columns, sort, selection, row menu stopPropagation), column picker persistence, filter popover staging, employee-list URL wiring + bulk action visibility by permission + result modal, CSV util, detail-screen gate fix.

## Implementation notes (2026-09-28, divergences from the plan)
- Row `⋯` menus on the last two rows open upward (when the page has more than 4 rows) up front, rather than waiting for the browser check to show clipping.
- The old employee-table's attendance-warning tooltip CSS rule was not carried over (the new table has no tooltip element); all other employee-cell rules were copied.
- `.emp-toolbar` / `.emp-pager` have no own margins — `.emp-section`'s existing `gap: 1rem` spaces them.
- `List_FilterByEmploymentType_ReturnsOnlyMatchingRows` seeds its own `employment_types` row, because `EmployeesListIntegrationTests`' fixture never seeds that lookup (labels fell back to the raw id). It also asserts an unknown code returns nothing.
- Employee-list spec: `flushEmployees` is async and awaits `whenStable()` (matching the spec's existing tests); one extra test confirms the view-cycle button is gone.
- Detail spec: the permission stub gained a 5th `hasOffboardPermission` parameter; the new tests click the `<button>` inside the `app-button` trigger.
- Not covered by automated tests (listed in Testing above but not in the plan): integration tests for filtering by position / manager, and for bulk change-position with an out-of-scope employee.

### Open questions found while implementing
- **Write scope vs. list visibility.** The list decides visibility with `IEmployeeAuthorityResolver`; the new `EmployeeManageScopeGuard` uses the legacy `IEmployeeVisibilityScopeResolver` + `GetVisibleByIdAsync` (same as the detail screen). A non-`org:manage` user could see a row in the list and still get "You do not have access to manage this employee." on a bulk action.
- **Filter options vs. list company.** The filter popover loads departments/positions/managers for `LegalEntityStore.selectedLegalEntityId`, but the list request never sends `legalEntityId` (no interceptor adds it), so the backend lists the caller's *default* company. If the switcher is on a different company, filter options and rows disagree.
- Pending-invitee rows appended by `ListEmployeesQueryHandler` bypass the new position/type/manager filters and sorting (pre-existing behaviour for search/department too).
