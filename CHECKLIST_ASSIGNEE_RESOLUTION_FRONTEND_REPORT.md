# Checklist assignee resolution — frontend

Date: 2026-08-20  
Branch: `feature/employee-management-phase1-foundation`  
No commit or push.

## Verified backend id

Checklist task `assignedToId` is a **UserId**, not an EmployeeId. The wizard does **not** send `employeeId` from active-holders. It loads `GET /api/v1/people/checklist-assignees` and serializes `userId`.

## Files changed (this assignment)

- `src/app/modules/people/models/checklist-template.model.ts`
- `src/app/modules/people/data-access/people-api.service.ts`
- `src/app/modules/people/data-access/people-api.service.spec.ts`
- `src/app/modules/people/utils/draft-checklist-task.utils.ts`
- `src/app/modules/people/utils/draft-checklist-task.utils.spec.ts` (new)
- `src/app/modules/people/state/add-employee-wizard.store.ts`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html`
- `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`
- `src/app/modules/people/feature/checklist-builder/checklist-builder.component.ts`
- `src/app/modules/people/feature/checklist-builder/checklist-builder.component.html`
- `src/app/modules/people/feature/checklist-builder/checklist-builder.component.css`
- `src/app/modules/people/feature/checklist-builder/checklist-builder.component.spec.ts`

Unrelated already-dirty files (login, invitation, payroll, shared input) were **not** part of this work.

## Endpoint / payload contract

### Lookup

`GET {apiUrl}/people/checklist-assignees?legalEntityId=&positionId=`

Uses `userId` as the selected assignee.

### Template builder

Employee: `ownerType=employee`, `assignedToId=null`, `assigneePositionId=null`.

Existing employee by position: `ownerType=custom_user`, `assignedToId=null`, `assigneePositionId=<position>`.

Optional specific employee in template: `ownerType=custom_user`, `assignedToId=<userId>`, `assigneePositionId=<position>`.

Builder UI now uses pill states:

- `+ Assign`
- `New employee`
- `Position`
- `Position + employee`

### Add Employee `editedTasksJson`

Employee: `{ title, dueDate, sequence, isRequired, ownerType: "employee" }` — no `assignedToId`.

Another person: `{ ..., ownerType, assignedToId: <userId>, assigneePositionId }`.

Draft edits never PATCH the checklist template.

## Template vs onboarding assignment

Template = reusable rule (position is enough, employee optional).  
Onboarding draft = concrete plan (another-person tasks require a seated active person).

Builder UI: `+ Assign` opens `New employee` vs `Existing employee`; existing employee opens a searchable position picker, then optionally a searchable employee picker. Removing an employee keeps the position pill; removing the position clears the assignment.

Wizard UI: unresolved template assignments show `+ Assign` / `+ Select employee *`; employee tasks render as the new hire’s name; existing-employee tasks use position and employee pills with searchable pickers. Empty state remains “No active employees are assigned to this position yet.” Inline errors stay on the task row; Save Draft / Finalize block until valid.

## Tests run

- `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`: **37 files, 278 passed**
- `npm run build`: succeeded (`dist/Customer-web-application`)
- `git diff --check`: clean

## Skipped checks

- E2E / Playwright of the wizard
- Mapping of 400 field errors onto specific task rows beyond existing `ErrorHandlerService` toasts
- Offboarding checklist assignment UI
- Position/employee counts in the position picker (no dedicated aggregate endpoint yet)

## Remaining risks

- Legacy templates with only `assignedToId` and no `assigneePositionId` still require HR to pick a position in the wizard (frontend validation requires both).
- Company position list uses `listFlat` pageSize 200; very large orgs may not list every position.
- Builder and wizard component CSS now exceed the repo's existing per-component warning budget, but the Angular build still succeeds.
- Builder still uses internal form value `company_position`; UI wording is now `Existing employee`.
