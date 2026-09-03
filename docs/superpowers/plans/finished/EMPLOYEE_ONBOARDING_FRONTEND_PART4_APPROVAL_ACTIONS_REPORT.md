# Employee Onboarding Phase 1 Foundation – Part 4 Implementation Report

**Target Workspace:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
**Date:** 2026-08-11  
**Status:** Part 4 Audit & Verification Complete (Blocked from Real Approval UI due to missing Backend List/Read Endpoint)  

---

## 1. Executive Summary

Part 4 audited the backend API contracts and frontend implementation for Employee Onboarding Approval Actions (Access Grant Requests).

As strictly instructed by the task specification ("If no list/read endpoint exists, do not fake an approval queue" and "Do not create fake frontend data"), a real approval queue UI was **blocked** from being rendered because the backend (`HRMS-Backend-v1`) does not currently provide any list/read endpoint for pending onboarding access grant requests.

---

## 2. Backend Inspection & Contract Audit Findings

### Backend Endpoints Found:
1. `POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite`
   - **Controller:** `AccessGrantRequestsController` (`src/ONEVO.Api/Controllers/Tenant/CoreHr/AccessGrantRequestsController.cs`)
   - **Permission:** `employees:write`
   - **Request Body:** None (route `{id}`)
   - **Response DTO:** `ApproveAccessGrantRequestResponse` (`accessGrantRequestId`, `onboardingDraftId`, `employeeId`, `finalizationStatus`, `invitationQueued`, `checklistTaskCount`, `positionApprovalStatus`, `messageKey`)

2. `POST /api/v1/onboarding/access-grant-requests/{id}/reject`
   - **Controller:** `AccessGrantRequestsController`
   - **Permission:** `employees:write`
   - **Request Body:** `{ decisionNote?: string | null }`
   - **Response DTO:** `RejectAccessGrantRequestResponse` (`accessGrantRequestId`, `onboardingDraftId`, `requestStatus`, `draftStatus`, `draftReason`, `messageKey`)

### Backend Endpoints Missing:
- **No List/Read Endpoint:** There is **no GET/list endpoint** for pending onboarding access grant requests (e.g., `GET /api/v1/onboarding/access-grant-requests?status=pending` or `GET /api/v1/onboarding/drafts/{id}/access-grant-request`).
- **No ID Mapping on Draft List:** Neither `DraftListItemResponse` (`id`, `displayName`, `positionName`, `departmentName`, `status`, `draftReason`, `lastSavedStep`, `startedByName`) nor `FinalizeOnboardingDraftResponse` returns an `accessGrantRequestId` or any reference to the created `AccessGrantRequest`.

---

## 3. Implementation Status & UI Handling

Per task rules for missing list/read endpoints:
1. **No Fake Data / Queue:** No mock queues, hardcoded data, or fake approve/reject buttons were created in the frontend.
2. **Draft Table Safety:** `DraftTableComponent` safely displays drafts with `status: 'waiting_for_position_approval'` and `draftReason: 'position_approval_rejected'` or `'waiting_for_position_approval'` using human-readable labels (`"Draft – waiting for approval"`, `"Waiting for position approval"`, `"Position approval rejected"`).
3. **Button Gating:** Only `"Continue Draft"` button is rendered for drafts (gated by `employees:write`), allowing HR starters to resume and edit drafts (including re-submitting rejected position approval requests). No fake Approve/Reject action buttons are rendered without a valid server request ID.
4. **Finalize Store & Toast Handling:** `AddEmployeeWizardStore` and `AddEmployeeWizardComponent` safely handle `positionApprovalPending: true` from `POST /api/v1/onboarding/drafts/{id}/finalize`, updating `lastSaveStatus` and displaying the info toast *"Position approval was requested before the invitation can be sent."*.

---

## 4. Files Modified / Checked

- `src/app/modules/people/state/add-employee-wizard.store.spec.ts`: Added unit test verifying `finalizeDraft` stores `positionApprovalPending: true` response safely in `finalizeResult()`.
- `src/app/modules/people/ui/draft-table/draft-table.component.spec.ts`: Added unit tests verifying human-readable label translations for `waiting_for_position_approval` & `position_approval_rejected` and asserting no fake Approve/Reject buttons are rendered without request IDs.
- `EMPLOYEE_ONBOARDING_FRONTEND_PART4_APPROVAL_ACTIONS_REPORT.md`: Created this report.

---

## 5. Verification Results

### Unit Tests
Executed `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`:
```
Test Files  7 passed (7)
     Tests  57 passed (57)
  Duration  2.86s
```
All 57 unit tests passed across all people module test suites.

### Build Verification
Executed `npm run build`:
```
Application bundle generation complete. [5.157 seconds] - 0 errors
```

### Git Whitespace Check
Executed `git diff --check`:
```
0 whitespace errors
```

---

## 6. Skipped Checks

- No backend changes were made or built (strictly adhering to "Do not edit backend").
- No git commits or pushes were executed (satisfying task constraints).

---

## 7. Exact Backend Follow-Up Prompt

When ready to enable the real Approval Actions UI in the frontend, provide the following prompt to the backend development team:

```markdown
Please implement a list/read endpoint for pending onboarding access grant requests in HRMS-Backend-v1.

Suggested route & contract:

GET /api/v1/onboarding/access-grant-requests?status=pending&actionType=onboarding
Permission: employees:write (or dedicated approval permission if seeded)

Response DTO:
{
  "items": [
    {
      "id": "guid (accessGrantRequestId)",
      "onboardingDraftId": "guid",
      "displayName": "string (Employee First + Last Name)",
      "positionName": "string | null",
      "departmentName": "string | null",
      "requestedRoleName": "string | null",
      "requestedByName": "string | null",
      "requestedAt": "string (ISO date)",
      "status": "Pending"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 25
}

Alternatively, include `accessGrantRequestId` in `DraftListItemResponse` (GET /api/v1/onboarding/drafts) when status is `waiting_for_position_approval`.
```
