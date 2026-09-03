# Employee Onboarding Frontend Contract Report (Part 2)

## Overview

This report documents Part 2 of the Employee Onboarding contract update in `C:\onevoNew\Hrms--Web-application---front-end---v1`.

All DTO models, API services, Signal stores, form controls, and unit tests have been updated to adhere strictly to the backend contracts established in `HRMS-Backend-v1`.

---

## Files Changed

1. `src/app/modules/people/models/onboarding-draft.model.ts`
   - Replaced `employeeName` in `SaveOnboardingDraftPayload` and `OnboardingDraftResponse` with `firstName: string` and `lastName: string`.
   - Added `workModeId: number` (int) to `SaveOnboardingDraftPayload` and `OnboardingDraftResponse`.
   - Removed `scheduleId` from `SaveOnboardingDraftPayload` and `OnboardingDraftResponse`.
   - Updated `DraftListItemResponse` with `displayName: string` while keeping `employeeName?: string` for backward compatibility.
   - Expanded `DraftReason` union to include `saved_manually`, `waiting_for_seat`, `waiting_for_position_approval`, `position_approval_rejected`, `seat_configuration_required`, and `invitation_sent`.
   - Added labels for new draft reasons in `DRAFT_REASON_LABELS`.
   - Added interfaces: `WorkModeOption`, `FinalizeOnboardingDraftResponse`, `ApproveAccessGrantRequestResponse`, `RejectAccessGrantRequestRequest`, `RejectAccessGrantRequestResponse`.

2. `src/app/modules/people/data-access/people-api.service.ts`
   - Added `getWorkModes(): Observable<readonly WorkModeOption[]>` calling `GET /api/v1/work-modes`.
   - Added `finalizeDraft(id: string): Observable<FinalizeOnboardingDraftResponse>` calling `POST /api/v1/onboarding/drafts/${id}/finalize`.
   - Added `approveAccessGrantRequest(id: string): Observable<ApproveAccessGrantRequestResponse>` calling `POST /api/v1/onboarding/access-grant-requests/${id}/approve-and-send-invite`.
   - Added `rejectAccessGrantRequest(id: string, payload?: RejectAccessGrantRequestRequest): Observable<RejectAccessGrantRequestResponse>` calling `POST /api/v1/onboarding/access-grant-requests/${id}/reject`.
   - Updated `saveDraft` payload handling to send `firstName`, `lastName`, `workModeId`, and exclude `employeeName` / `scheduleId`.

3. `src/app/modules/people/state/add-employee-wizard.store.ts`
   - Updated `AddEmployeeFormValue` with `firstName`, `lastName`, `workModeId: number | null`.
   - Removed schedule state.
   - Added state properties: `workModes`, `loadingWorkModes`, `workModesError`, `finalizing`, `finalizeError`, `finalizeResult`.
   - Added methods: `loadWorkModes()`, `finalizeDraft(id: string)`.
   - Updated `saveDraft` to send `firstName`, `lastName`, `workModeId` (defaulting to 0 if null).
   - Updated `resumeDraft` to hydrate `firstName`, `lastName`, `workModeId`.

4. `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` & `html`
   - Minimal binding updates for compilation: replaced `employeeName` control with `firstName`, `lastName`, `workModeId` (select input bound to `store.workModes()`), and added `maxLength(254)` for work email.
   - Auto-calls `store.loadWorkModes()` upon component initialization.

5. `src/app/modules/people/ui/draft-table/draft-table.component.html`
   - Updated table display name column binding to `draft.displayName || draft.employeeName`.

6. Spec Files (`*.spec.ts`)
   - `people-api.service.spec.ts`: Added tests for `getWorkModes`, `finalizeDraft`, `approveAccessGrantRequest`, `rejectAccessGrantRequest`, and verified `saveDraft` sends `firstName`, `lastName`, `workModeId` and omits `employeeName` / `scheduleId`.
   - `add-employee-wizard.store.spec.ts`: Added tests for `loadWorkModes`, `finalizeDraft`, error handling, and `saveDraft`/`resumeDraft` payload mappings.
   - `people.store.spec.ts`: Updated mock `DraftListItemResponse` with `displayName`.
   - `add-employee-wizard.component.spec.ts`: Updated form control assertions and flushed `/work-modes` requests.
   - `draft-table.component.spec.ts`: Updated mock `DraftListItemResponse` with `displayName`.

---

## Backend Contracts Followed

- **Draft Save Payload**:
  - `firstName` (max 100) & `lastName` (max 100) sent instead of `employeeName`.
  - `workModeId` (`int`) sent matching backend seeded lookup values.
  - `scheduleId` omitted.
  - `workEmail` validated up to 254 chars.
- **Work Modes Endpoint**:
  - `GET /api/v1/work-modes` returns `readonly WorkModeOption[]` (`id: number`, `code: string`, `label: string`).
- **Finalization Endpoint**:
  - `POST /api/v1/onboarding/drafts/{id}/finalize` maps to `FinalizeOnboardingDraftResponse`.
- **Access Grant Request Endpoints**:
  - `POST /api/v1/onboarding/access-grant-requests/{id}/approve-and-send-invite` maps to `ApproveAccessGrantRequestResponse`.
  - `POST /api/v1/onboarding/access-grant-requests/{id}/reject` accepts `RejectAccessGrantRequestRequest` (`decisionNote?: string | null`) and maps to `RejectAccessGrantRequestResponse`.

---

## Verification Results

1. **Angular Unit Tests**:
   - Command: `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`
   - Result: **48/48 passed across 7 spec files** (0 failures).

2. **Production Build**:
   - Command: `npm run build`
   - Result: **Build completed successfully with 0 errors**.

3. **Git Diff Check**:
   - Command: `git diff --check`
   - Result: **0 whitespace / syntax errors**.

---

## Skipped Checks

- No backend changes were made or tested (backend scope untouched).
- No git commit or push was executed per instructions.

---

## Remaining Part 3 Work (UI / Flows)

1. **Full Finalization UX**:
   - Connect "Finalize Employee" button on wizard Step 4 / draft row actions to `store.finalizeDraft(id)`.
   - Handle response branches (position approval pending vs pending employee created / invite sent).
   - Display confirmation modal or status banner based on `FinalizeOnboardingDraftResponse`.

2. **Access Grant Request Approval Queue**:
   - Build approval list/table for pending position access grant requests (`GET /api/v1/onboarding/access-grant-requests` if introduced or pending draft tab).
   - Provide "Approve & Send Invite" and "Reject" modal dialogs (capturing `decisionNote` on reject).
   - Wire actions to `approveAccessGrantRequest` and `rejectAccessGrantRequest` in `PeopleApiService`.
