# Employee Onboarding Frontend Contract Audit

> **Scope:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
> **Status:** Audit-Only Complete · No implementation code modified · No commits/pushes  
> **Date:** August 11, 2026  

---

## 1. Current Frontend Files Inspected

The following files in `C:\onevoNew\Hrms--Web-application---front-end---v1` were thoroughly inspected:

### Routing & Feature Pages
- [`src/app/modules/people/people.routes.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/people.routes.ts): Route definitions for `/people/employees`, `/people/employees/new`, `/people/employees/:id`. Route `/new` is gated by `permissionGuard` with `employees:write`.
- [`src/app/modules/people/feature/employee-list/employee-list.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/employee-list/employee-list.component.ts): Main People page component with segmented tabs for "Employees" and "Onboarding Drafts".
- [`src/app/modules/people/feature/employee-list/employee-list.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/employee-list/employee-list.component.html): Template for People page with search input, tab buttons, and "+ Add Employee" button gated on `employees:write`.
- [`src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts): Multi-step wizard component (`employee_details`, `checklist_template`, `checklist_review`, `review_and_submit`).
- [`src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html): Wizard step templates, form controls, review summary, and "Save Draft" action.

### Presentational UI Components
- [`src/app/modules/people/ui/draft-table/draft-table.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/draft-table/draft-table.component.ts): Component rendering the drafts list table.
- [`src/app/modules/people/ui/draft-table/draft-table.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/draft-table/draft-table.component.html): Drafts table template with status badges, reasons, and "Continue Draft" action (gated on `employees:write`).
- [`src/app/modules/people/ui/employee-table/employee-table.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/employee-table/employee-table.component.ts): Component rendering active employees table.
- [`src/app/modules/people/ui/employee-table/employee-table.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/employee-table/employee-table.component.html): Employee table template.

### Models & Services
- [`src/app/modules/people/models/employee.model.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/models/employee.model.ts): `EmployeeListItemResponse`, `EmployeeListPageResponse`, `EmployeeListParams`.
- [`src/app/modules/people/models/onboarding-draft.model.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/models/onboarding-draft.model.ts): `OnboardingDraftResponse`, `DraftListItemResponse`, `SaveOnboardingDraftPayload`, `DraftStatus`, `DraftReason`, `WizardStep`.
- [`src/app/modules/people/data-access/people-api.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/data-access/people-api.service.ts): HTTP client methods for `/employees` and `/onboarding/drafts`.
- [`src/app/modules/people/state/people.store.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/state/people.store.ts): NgRx Signal Store for employee and draft list views.
- [`src/app/modules/people/state/add-employee-wizard.store.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/state/add-employee-wizard.store.ts): NgRx Signal Store for wizard state, draft saving, and draft resuming.

### Cross-Domain Dependencies & Infrastructure
- [`src/app/modules/organization/state/legal-entity.store.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/state/legal-entity.store.ts): Topbar company selector and active company context.
- [`src/app/modules/organization/models/legal-entity.model.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/models/legal-entity.model.ts): `LegalEntityListItem`, `LegalEntityGeneralSettings`.
- [`src/app/modules/organization/data-access/department-api.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/data-access/department-api.service.ts): Department flat list API.
- [`src/app/modules/organization/data-access/position-api.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/data-access/position-api.service.ts): Position flat list and position access API.
- [`src/app/core/services/notification.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/services/notification.service.ts): Toast notification service (`success`, `error`, `warning`, `info`).
- [`src/app/core/services/error-handler.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/services/error-handler.service.ts): Safe error message translation (`toSafeErrorMessage`).
- [`src/app/core/guards/permission.guard.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/guards/permission.guard.ts): Route permission guard.
- [`src/app/core/auth/state/permission.service.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/auth/state/permission.service.ts): Permission evaluation service.

### Unit Test Suites
- [`src/app/modules/people/data-access/people-api.service.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/data-access/people-api.service.spec.ts)
- [`src/app/modules/people/state/people.store.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/state/people.store.spec.ts)
- [`src/app/modules/people/state/add-employee-wizard.store.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/state/add-employee-wizard.store.spec.ts)
- [`src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts)
- [`src/app/modules/people/feature/employee-list/employee-list.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/feature/employee-list/employee-list.component.spec.ts)
- [`src/app/modules/people/ui/draft-table/draft-table.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/draft-table/draft-table.component.spec.ts)
- [`src/app/modules/people/ui/employee-table/employee-table.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/ui/employee-table/employee-table.component.spec.ts)

---

## 2. Current API Payloads and Response Models Found

### `SaveOnboardingDraftPayload` (Current Frontend Request DTO)
```typescript
export interface SaveOnboardingDraftPayload {
  draftId?: string;
  employeeName: string; // ❌ Backend expects firstName and lastName
  workEmail: string;
  legalEntityId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentType: string;
  startDate: string;
  employeeNumber: string | null;
  scheduleId: string | null; // ❌ Backend removed scheduleId column
  selectedTemplateId: string | null;
  editedTasksJson: string | null;
  lastSavedStep: WizardStep;
}
```

### `OnboardingDraftResponse` (Current Frontend Response DTO)
```typescript
export interface OnboardingDraftResponse {
  readonly id: string;
  readonly employeeName: string; // ❌ Backend returns firstName & lastName
  readonly workEmail: string;
  readonly legalEntityId: string;
  readonly departmentId: string | null;
  readonly positionId: string | null;
  readonly employmentType: string;
  readonly startDate: string;
  readonly employeeNumber: string | null;
  readonly scheduleId: string | null; // ❌ Removed on backend
  readonly selectedTemplateId: string | null;
  readonly editedTasksJson: string | null;
  readonly status: DraftStatus;
  readonly draftReason: DraftReason | null;
  readonly lastSavedStep: WizardStep;
  readonly startedById: string;
  readonly version: string;
}
```

### `DraftListItemResponse` (Current Frontend Response DTO)
```typescript
export interface DraftListItemResponse {
  readonly id: string;
  readonly employeeName: string; // Backend returns resolved employeeName (or firstName/lastName)
  readonly positionName: string | null;
  readonly departmentName: string | null;
  readonly status: DraftStatus;
  readonly draftReason: DraftReason | null;
  readonly lastSavedStep: WizardStep;
  readonly startedByName: string;
}
```

---

## 3. Exact Mismatches with Backend Contract

| # | Item | Current Frontend | Backend Contract (Reports 1–5) | Impact |
|---|---|---|---|---|
| 1 | **Identity Fields** | Uses single `employeeName` string in payload, form, and response DTO. | Replaced with `firstName` (max 100) and `lastName` (max 100). Migration `20260810153000` dropped `employee_name` column. | API save draft fails due to missing required `firstName`/`lastName`. |
| 2 | **Work Mode Field** | Absent in models, form, wizard store, and UI. | `workModeId` (Guid) is required on draft save and validated against global `work_modes` lookup table. | API save draft fails due to missing `workModeId`. |
| 3 | **Work Schedule Field** | DTO contains `scheduleId: string \| null` (hardcoded `null`). Store has `schedules` state array. | `scheduleId` column dropped from backend database. Shift/schedule management is deferred. | Sending `scheduleId` is invalid/dead property. |
| 4 | **Draft Reasons** | Enum union has only `saved_manually`, `waiting_for_seat`, `waiting_for_position_approval`. | Backend includes `position_approval_rejected`, `seat_configuration_required`, `invitation_sent`. | Raw codes displayed or unhandled when backend returns `position_approval_rejected` or `seat_configuration_required`. |
| 5 | **Draft Finalization Endpoint** | Completely missing in frontend API service, store, and UI. | `POST /api/v1/onboarding/drafts/{id}/finalize` exists and creates employee/user/invite flow (or access grant request if approval required). | Onboarding cannot be completed from frontend. |
| 6 | **Access Grant Approval Endpoints** | Completely missing in frontend API service, store, and UI. | `POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite` and `POST /api/v1/onboarding/access-grant-requests/{id}/reject` exist. | Position access grant requests cannot be approved or rejected from frontend. |
| 7 | **Work Email Max Length** | Form uses `Validators.email` without `maxLength`. | Email 255–320 chars passes draft validator on backend but hits `varchar(255)` column constraint at finalize (500 error). | Frontend allows invalid email length that crashes finalization. |

---

## 4. Dead / Unused Code Found

1. **`scheduleId` Property:**
   - Present in `SaveOnboardingDraftPayload` and `OnboardingDraftResponse` in [`src/app/modules/people/models/onboarding-draft.model.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/models/onboarding-draft.model.ts).
   - `schedules: readonly SelectOption[]` and `schedulesUnavailable: true` in [`src/app/modules/people/state/add-employee-wizard.store.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/people/state/add-employee-wizard.store.ts).
2. **Empty Directory:**
   - `src/app/modules/people/utils/` is an empty folder with no utility functions or mappers.
3. **Static Empty-State Step Stubs:**
   - Wizard steps `checklist_template` and `checklist_review` render static `<app-empty-state>` components without real checklist template fetching or task editing.

---

## 5. Missing Frontend Endpoints / Models / States

### Missing Endpoints
- `POST /api/v1/onboarding/drafts/{id}/finalize` (Finalize onboarding draft)
- `POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite` (Approve access grant & issue invite)
- `POST /api/v1/onboarding/access-grant-requests/{id}/reject` (Reject access grant request)
- `GET /api/v1/work-modes` or `GET /api/v1/infrastructure/work-modes` (Work modes lookup endpoint)

### Missing Models & Interfaces
- `WorkModeLookupItem`: `{ id: string; code: string; name: string; isActive: boolean }`
- `FinalizeOnboardingDraftResponse`: `{ onboardingDraftId: string; employeeId: string | null; userId: string | null; status: string; draftStatus: string; draftReason: string | null; requiresApproval: boolean; accessGrantRequestId: string | null; messageKey: string }`
- `ApproveAccessGrantRequestResponse`: `{ accessGrantRequestId: string; onboardingDraftId: string; employeeId: string; finalizationStatus: string; invitationQueued: boolean; checklistTaskCount: number; positionApprovalStatus: string; messageKey: string }`
- `RejectAccessGrantRequestRequest`: `{ decisionNote?: string | null }`
- `RejectAccessGrantRequestResponse`: `{ accessGrantRequestId: string; onboardingDraftId: string; requestStatus: string; draftStatus: string; draftReason: string | null; messageKey: string }`

### Missing Store & State Capabilities
- `AddEmployeeWizardStore`:
  - `workModes: readonly SelectOption[]`, `loadingWorkModes: boolean`, `workModeId: string | null`
  - `finalizing: boolean`, `finalizeError: string | null`, `finalizeResult: FinalizeOnboardingDraftResponse | null`
  - Method `loadWorkModes()`
  - Method `finalizeDraft(id: string)`

---

## 6. Permission Gaps

- **Current Route & Component Protection:**
  - Route `/people/employees`: `employees:read`
  - Route `/people/employees/new`: `employees:write`
  - "+ Add Employee" button: `canAddEmployee()` -> `PermissionService.hasPermission('employees:write')`
  - "Continue Draft" button: `*appHasPermission="'employees:write'"`
- **Backend Action Permissions:**
  - `Finalize` endpoint: `employees:write`
  - `Approve & Send Invite` endpoint: `employees:write`
  - `Reject` endpoint: `employees:write`
- **Gap Assessment:**
  - Route and action permissions are well-aligned. Finalization and approval actions must be gated on `employees:write`.
  - No new permission codes should be invented.

---

## 7. Toast / Error-Message Gaps

1. **Finalization Error Toasting:**
   - Finalization can return 409 Conflict (e.g. duplicate email, duplicate employee number, position capacity, seat blocked), 422 Unprocessable Entity, or 500.
   - The wizard currently displays inline messages for seat/position approval on draft save, but lacks dedicated toast notification handling for finalization actions (`this.notificationService.success(...)` / `this.notificationService.error(...)`).
2. **Email Length Validation:**
   - Work email lacks a max length validator (254 chars). Submitting a >255 char email leads to a 500 error at finalization instead of a clean form validation message.

---

## 8. Test Gaps

1. **First Name / Last Name:** No unit tests cover splitting or validating `firstName` and `lastName`.
2. **Work Mode:** No unit tests cover fetching `work_modes` lookups or passing `workModeId` in draft payloads.
3. **Draft Finalization:** No unit tests cover calling `PeopleApiService.finalizeDraft`, handling `FinalizeOnboardingDraftResponse`, or store finalization state transitions.
4. **Access Grant Request Endpoints:** No unit tests exist for `approveAndSendInvite` or `reject` methods in `PeopleApiService`.
5. **Outdated DTO Mocks:** Existing unit tests in `people-api.service.spec.ts`, `add-employee-wizard.store.spec.ts`, and `add-employee-wizard.component.spec.ts` use `employeeName` and `scheduleId` in mocks, which will break when contracts are updated.

---

## 9. Recommended Part 2 Implementation Prompt

```markdown
Implement Employee Onboarding Frontend Contract Updates in C:\onevoNew\Hrms--Web-application---front-end---v1.

Scope: Update models, API services, stores, UI forms, and unit tests to achieve 100% contract compliance with backend onboarding corrections, draft finalization, and access grant request endpoints.

Do not edit backend code. Do not commit or push.

Exact Files to Create / Modify:

1. [MODIFY] src/app/modules/people/models/onboarding-draft.model.ts
   - Replace employeeName with firstName: string and lastName: string in SaveOnboardingDraftPayload, OnboardingDraftResponse, and DraftListItemResponse.
   - Add workModeId: string in SaveOnboardingDraftPayload and OnboardingDraftResponse.
   - Remove scheduleId from SaveOnboardingDraftPayload and OnboardingDraftResponse.
   - Expand DraftReason to include: 'saved_manually' | 'waiting_for_seat' | 'waiting_for_position_approval' | 'position_approval_rejected' | 'seat_configuration_required' | 'invitation_sent'.
   - Add DRAFT_REASON_LABELS mapping for position_approval_rejected ('Position approval rejected') and seat_configuration_required ('Seat configuration required').
   - Add interfaces:
     - WorkModeOption: { id: string; code: string; name: string; isActive: boolean }
     - FinalizeOnboardingDraftResponse: { onboardingDraftId: string; employeeId: string | null; userId: string | null; status: string; draftStatus: string; draftReason: string | null; requiresApproval: boolean; accessGrantRequestId: string | null; messageKey: string }
     - ApproveAccessGrantRequestResponse: { accessGrantRequestId: string; onboardingDraftId: string; employeeId: string; finalizationStatus: string; invitationQueued: boolean; checklistTaskCount: number; positionApprovalStatus: string; messageKey: string }
     - RejectAccessGrantRequestRequest: { decisionNote?: string | null }
     - RejectAccessGrantRequestResponse: { accessGrantRequestId: string; onboardingDraftId: string; requestStatus: string; draftStatus: string; draftReason: string | null; messageKey: string }

2. [MODIFY] src/app/modules/people/data-access/people-api.service.ts
   - Add getWorkModes(): Observable<readonly WorkModeOption[]> calling GET /api/v1/work-modes (or /api/v1/infrastructure/work-modes).
   - Add finalizeDraft(id: string): Observable<FinalizeOnboardingDraftResponse> calling POST /api/v1/onboarding/drafts/{id}/finalize.
   - Add approveAccessGrantRequest(id: string): Observable<ApproveAccessGrantRequestResponse> calling POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite.
   - Add rejectAccessGrantRequest(id: string, payload?: RejectAccessGrantRequestRequest): Observable<RejectAccessGrantRequestResponse> calling POST /api/v1/onboarding/access-grant-requests/{id}/reject.

3. [MODIFY] src/app/modules/people/state/add-employee-wizard.store.ts
   - Update AddEmployeeFormValue: replace employeeName with firstName: string and lastName: string; add workModeId: string.
   - Add workModes: readonly SelectOption[] and loadingWorkModes: boolean to AddEmployeeWizardState.
   - Add loadWorkModes() method to fetch active work modes.
   - Update saveDraft() payload to map firstName, lastName, and workModeId, omitting scheduleId.
   - Add finalizeDraft(id: string) method that handles finalization status responses (success, waiting_for_seat, waiting_for_position_approval).

4. [MODIFY] src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts & html
   - Update reactive form: replace employeeName with firstName (Validators.required, max 100) and lastName (Validators.required, max 100). Add workEmail maxLength 254 validator. Add workModeId control (Validators.required).
   - Add Work Mode select dropdown in Step 1 (Employee Details).
   - Add "Finalize Onboarding" button on Step 4 (Review & Submit) alongside "Save Draft", calling finalizeDraft().
   - Display clear notification messages on success or draft fallback (waiting for seat / position approval).

5. [MODIFY] src/app/modules/people/ui/draft-table/draft-table.component.html & ts
   - Display full name (firstName + lastName or resolved employeeName) and updated status/reason labels.

6. [MODIFY] Unit Tests (*.spec.ts)
   - Update mock DTOs and test cases in people-api.service.spec.ts, people.store.spec.ts, add-employee-wizard.store.spec.ts, add-employee-wizard.component.spec.ts, draft-table.component.spec.ts, employee-table.component.spec.ts to reflect the new DTO contracts (firstName, lastName, workModeId, no scheduleId, finalize API, approve/reject API).
```
