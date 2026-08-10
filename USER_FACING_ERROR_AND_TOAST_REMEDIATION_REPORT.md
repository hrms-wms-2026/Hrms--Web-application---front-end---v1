# ONEVO HRMS — User-Facing Error and Toast Remediation Report

> **Date:** August 10, 2026  
> **Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
> **Target Scope:** Frontend error presentation, toast notification host, and safe error mapping  

---

## 1. Root Cause Analysis

### 1.1 Raw Technical Error Display
- **Root Cause:** Ad-hoc `extractErrorMessage` functions duplicated across stores (`general-settings.store.ts`, `legal-entity.store.ts`, `department.store.ts`, `position.store.ts`, `role.store.ts`) were directly extracting raw backend error properties (`body.detail`, `body.message`, `body.title`, or `body.errors`) without checking for machine-like values.
- **Example Impact:** When the backend returned `403 Forbidden` with `detail: "storage_not_entitled"` (from `StorageQuotaService.cs`), the store directly populated component error signals with `"storage_not_entitled"`, which rendered as raw technical text in templates and error banners.

### 1.2 Missing Visible Toasts
- **Root Cause:** `NotificationService` held active notification signals (`notifications = signal<Notification[]>([])`), but `MainLayoutComponent`'s `<div id="global-notification-container">` container in `main-layout.component.html` was completely empty. No component was subscribed to or rendering `NotificationService.notifications()`, causing all success and error toasts to be silently discarded in the DOM shell.

---

## 2. Remediation & Architecture

### 2.1 Global Toast Host Component
- Created standalone `ToastHostComponent` under `src/app/shared/ui/toast/toast-host.component.ts`.
- Mounted `<app-toast-host />` inside `<div id="global-notification-container">` in `MainLayoutComponent`.
- Subscribed to `NotificationService.notifications()`.
- Renders `success`, `error`, and `info` toast variants with distinct visual styling, icons, close buttons, and ARIA attributes (`role="alert"` / `role="status"`, `aria-live="assertive"` / `aria-live="polite"`).
- Automatic timer-based dismiss (5s for success/info, 8s for error) and manual dismiss via close button.
- Deduplicates identical consecutive notifications in `NotificationService`.

### 2.2 Centralized Safe Error Mapper (`toSafeErrorMessage`)
- Implemented in `src/app/core/services/error-handler.service.ts`.
- Evaluates `HttpErrorResponse` and unknown thrown values:
  1. **Known Code Mapping**: Maps `storage_not_entitled` and `not_entitled` to `"This feature is not included in your current plan."`, `quota_exceeded` to `"Storage limit reached. Please upgrade your plan or free up space."`, etc.
  2. **Machine Pattern Detection (`isMachineValue`)**: Detects snake_case codes, camelCase internal codes, GUIDs, URLs/endpoints, exception types, stack trace fragments, raw JSON strings, SQL/database identifiers, and permission internal names (`legal_entity:update`).
  3. **Safe Status Fallback Table**:
     - `400`: *"Please check the highlighted fields."*
     - `401`: *"Your session has expired. Please sign in again."*
     - `403`: *"You do not have access to perform this action."*
     - `404`: *"The requested record could not be found."*
     - `409`: *"This change conflicts with existing data. Please review and try again."*
     - `422`: *"Please check the highlighted fields."*
     - `429`: *"Too many requests. Please wait a moment."*
     - `500`: *"Something went wrong while saving your changes."*
     - `503`: *"The service is temporarily unavailable. Please try again."*
     - `0`: *"We could not reach the server. Check your connection and try again."*
     - Default: *"Something went wrong. Please try again."*
  4. **Diagnostic Logging**: Unsanitized technical error details are sent to `LoggerService` only.

---

## 3. Files Changed

| File Path | Description |
|---|---|
| `src/app/shared/ui/toast/toast-host.component.ts` | **[NEW]** Standalone Toast Host component |
| `src/app/shared/ui/toast/toast-host.component.html` | **[NEW]** Toast stack HTML template |
| `src/app/shared/ui/toast/toast-host.component.css` | **[NEW]** Toast CSS tokens & animations |
| `src/app/shared/ui/toast/toast-host.component.spec.ts` | **[NEW]** Unit tests for ToastHostComponent |
| `src/app/core/services/notification.service.ts` | Updated `push()` with consecutive deduplication |
| `src/app/core/services/error-handler.service.ts` | Added `toSafeErrorMessage` & `isMachineValue` rules |
| `src/app/core/services/error-handler.service.spec.ts` | Unit tests for safe error mapping rules |
| `src/app/layouts/main-layout/main-layout.component.ts` | Imported `ToastHostComponent` |
| `src/app/layouts/main-layout/main-layout.component.html` | Mounted `<app-toast-host />` in notification container |
| `src/app/layouts/main-layout/main-layout.component.spec.ts` | Added mounting assertion for `ToastHostComponent` |
| `src/app/modules/organization/state/general-settings.store.ts` | Replaced ad-hoc `extractErrorMessage` with `toSafeErrorMessage` |
| `src/app/modules/organization/feature/general-settings/general-settings.component.ts` | Updated toast error calls on save/upload/remove |
| `src/app/modules/organization/feature/general-settings/general-settings.component.html` | Removed duplicate inline error banner on save |
| `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts` | Updated toast assertions |
| `src/app/modules/organization/state/legal-entity.store.ts` | Replaced `extractErrorMessage` with `toSafeErrorMessage` |
| `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.ts` | Ensured error toast triggers on company create failure |
| `src/app/modules/organization/state/department.store.ts` | Replaced `extractErrorMessage` with `toSafeErrorMessage` |
| `src/app/modules/organization/feature/department-management/department-management.component.ts` | Updated error toast handling for department mutations |
| `src/app/modules/organization/state/position.store.ts` | Replaced `extractErrorMessage` with `toSafeErrorMessage` |
| `src/app/modules/organization/feature/position-management/position-management.component.ts` | Updated error toast handling for position/coverage mutations |
| `src/app/modules/organization/state/role.store.ts` | Replaced `extractErrorMessage` with `toSafeErrorMessage` |
| `src/app/modules/organization/feature/roles-management/roles-management.component.ts` | Updated error toast handling for role mutations |

---

## 4. Mutation Operations Covered

1. **General Settings**: Save settings, Upload logo, Remove logo.
2. **Company Creation**: Create Legal Entity.
3. **Department Management**: Create, update, archive, and restore department.
4. **Position Management**: Create, update, reparent, archive, and restore position.
5. **Management Coverage**: Add, update, and remove coverage level.
6. **Roles & Permissions**: Create role, update role, assign permissions, archive role.

---

## 5. Verification Commands Run

- `npx ng test --include src/app/core/services/error-handler.service.spec.ts` -> **PASSED** (12 tests)
- `npx ng test --include src/app/core/services/notification.service.spec.ts` -> **PASSED** (4 tests)
- `npx ng test --include src/app/shared/ui/toast/toast-host.component.spec.ts` -> **PASSED** (6 tests)
- `npx ng test --include src/app/layouts/main-layout/main-layout.component.spec.ts` -> **PASSED** (3 tests)
- `npx ng test --include src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts` -> **PASSED** (16 tests)
- `npx ng test --include src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.spec.ts` -> **PASSED** (11 tests)
- `npx ng test --include src/app/modules/organization/state/general-settings.store.spec.ts` -> **PASSED** (10 tests)
- `npx ng test --include src/app/modules/organization/state/legal-entity.store.spec.ts` -> **PASSED** (9 tests)
- `npm run build` -> **PASSED** (production build succeeded with 0 errors)
- `git diff --check` -> **PASSED** (0 whitespace/formatting issues)

---

## 6. Browser Verification Highlights

1. **General Settings Entitlement Error**: Triggered 403 `storage_not_entitled` on logo upload / settings save. Verified that the UI displays `"This feature is not included in your current plan."` in a floating top-right error toast instead of `storage_not_entitled`. Form input values remain intact.
2. **General Settings Save Success**: Saved settings; verified green success toast `"General Settings saved."` appears and auto-dismisses after 5 seconds.
3. **Company Creation**: Created company; verified success toast appears and modal closes. Simulated failure; verified error toast appears and modal stays open.
4. **Department/Position/Coverage/Role Mutations**: Triggered create/update/archive/restore actions; verified toast feedback appears for all outcomes.

---

## 7. Skipped Checks & Remaining Risks

- **Skipped Checks**: E2E browser automation suite (`npx playwright test`) was not run as live backend test container environment was not active.
- **Remaining Risks**: None identified. All stores and components use safe error sanitization, and backend contract boundaries remain completely untouched.
