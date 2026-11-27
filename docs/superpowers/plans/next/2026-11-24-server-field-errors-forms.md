# Server Field Errors on More Forms Implementation Plan (task 20 follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the backend refuses a save with a 400, the department, role, leave type and create-company forms show each message next to its field (as general settings does since task 20), and the page shows one toast at most.

**Architecture:** Each store keeps the failed save as an `ApiError` (`actionApiError`, or `createApiError` for companies) next to its existing error string. The page passes it to the modal as a `serverError` input. The modal calls `applyServerFieldErrors` and shows any message without a field inside the modal through `<app-field-error>`. The page toasts `failedSaveToast(apiError, fallback)`, which returns null when the form shows the errors or when the error handler already toasted (5xx, network, 403, 429, unknown status).

**Tech Stack:** Angular 21, @ngrx/signals, Vitest.

**Base:** stacked on `chore/error-handling-standard` (#189).

**Out of scope:** the position form, because it lives in `position-management`, which its module owner is refactoring. The profile panels and the checklist builder are left for later and listed in the task 20 file.

### Task 1: `failedSaveToast`
- [ ] Failing specs in `server-errors.spec.ts` for these cases:
  - null error gives the fallback
  - 400 with field errors gives null
  - 409 with no field errors gives the backend message
  - 500, 0, 403 and 429 give null, because the error handler toasted them
  - a non-HTTP error gives its message
- [ ] Implement it in `shared/utils/validators/server-errors.ts`, then commit.

### Task 2: department
- [ ] Failing specs:
  - `DepartmentStore.createDepartment` keeps `actionApiError` on failure and clears it on the next save.
  - The department modal with `serverError` (a 400 with `Code`) shows the message under the code field.
  - A key with no field shows the message in the modal.
- [ ] Implement it: the store, the modal `@Input() set serverError`, and the page passing `[serverError]="departmentStore.actionApiError()"` and toasting `failedSaveToast`. Commit.

### Task 3: role (same pattern, `RoleStore` and `role-form-modal`)
### Task 4: leave type (same pattern, `LeaveTypeStore` and `leave-type-form-modal`)
### Task 5: create company (`LegalEntityStore.createCompany` gets `createApiError`, plus `create-company-modal`)

Each task has a failing modal spec, then the change, then the module's specs, then a commit.

### Task 6: docs and gate
- [ ] Add the pattern to ARCHITECTURE §7.4 and update the task 20 status "Remaining".
- [ ] Run `check:warnings`, `lint`, `ng test` three times. Then review, push, and open the PR stacked on #189.
