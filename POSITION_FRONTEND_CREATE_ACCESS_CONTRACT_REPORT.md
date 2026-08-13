# Position Frontend Create & System Access Contract Implementation Report

## Overview
This document details the frontend implementation of position creation and system access configuration for the ONEVO HRMS application.

The implementation strictly preserves the backend contract:
- `POST /api/v1/org/legal-entities/{legalEntityId}/positions` accepts **only** position fields (`departmentId`, `name`, `code`, `positionType`, `maxOccupancy`, `reportsToPositionId`).
- System access is configured in a secondary operation via `PUT /api/v1/org/legal-entities/{legalEntityId}/positions/{positionId}/access` (`roleId`, `requiresApproval`).

---

## 1. Backend Contract Followed
- **Position Creation (`POST`)**:
  Payload: `{ departmentId, name, code, positionType, maxOccupancy, reportsToPositionId }`
  `CreatePositionRequest` interface strictly excludes `roleId` and `requiresApproval`. Unit tests explicitly assert that these fields are `undefined` in the HTTP POST body.
- **Position System Access (`PUT`)**:
  Endpoint: `PUT /api/v1/org/legal-entities/{legalEntityId}/positions/{positionId}/access`
  Payload: `{ roleId, requiresApproval }`
- **Position System Access (`GET`)**:
  Endpoint: `GET /api/v1/org/legal-entities/{legalEntityId}/positions/{positionId}/access`
  Returns: `PositionAccessTemplateResponse` (`positionId`, `roleId`, `roleName`, `requiresApproval`, `isActive`).

---

## 2. Centralized Theme Token Integration
- Added centralized `--color-warning`, `--color-warning-subtle`, and `--color-warning-text` design tokens to `src/app/shared/styles/theme-tokens.css`:
  - **Light Mode**: `--color-warning: #d97706`, `--color-warning-subtle: #fef3c7`, `--color-warning-text: #92400e`.
  - **Dark Mode (`:root[data-mode='dark']`, `html.dark`)**: `--color-warning: #f59e0b`, `--color-warning-subtle: #451a03`, `--color-warning-text: #fcd34d`.
- In `toast-host.component.css`, warning border and icon styling strictly reference `var(--color-warning)` without hardcoded hex fallbacks.

---

## 3. Position Access Permission Gating
- The Position Access action in the 3-dot dropdown menu (both in `PositionListTableComponent` and `PositionTreeNodeComponent`) is strictly gated by **both** permissions:
  - `org:manage`
  - `roles:read`
- If a user lacks either `org:manage` or `roles:read`, the `"Position Access"` menu item is hidden entirely from both tree and list views (`@if (canConfigureAccess)`).
- Programmatic attempts to open (`openAccessModal`) or submit (`onSaveAccess`) position access updates verify `canConfigureAccess()` (`hasManageAccess && hasRoleReadAccess`). Lacking either permission blocks execution and displays an error notification: `"You don't have permission to configure position system access."`

---

## 4. Files Changed & Created

### Core Services, Theme Tokens & Toast Notifications
- `src/app/shared/styles/theme-tokens.css`: Added centralized warning color custom properties for light and dark themes.
- `src/app/core/services/notification.service.ts`: Added `'warning'` notification kind and `.warning(message: string)` method.
- `src/app/core/services/notification.service.spec.ts`: Added unit test coverage for warning notifications.
- `src/app/shared/ui/toast/toast-host.component.ts`: Configured auto-dismiss duration (8000ms) for warning toasts.
- `src/app/shared/ui/toast/toast-host.component.html`: Added warning SVG alert icon block.
- `src/app/shared/ui/toast/toast-host.component.css`: Styled warning toast using `var(--color-warning)`.
- `src/app/shared/ui/toast/toast-host.component.spec.ts`: Added unit tests for warning toast rendering and accessibility attributes.

### Organization Domain Data Access & Stores
- `src/app/modules/organization/models/position.model.ts`: Added `SetPositionAccessRequest` and `PositionAccessTemplateResponse` interfaces.
- `src/app/modules/organization/data-access/position-api.service.ts`: Implemented `getPositionAccess` and `setPositionAccess` HTTP endpoints.
- `src/app/modules/organization/data-access/position-api.service.spec.ts`: Added unit tests for access API methods and POST payload purity.
- `src/app/modules/organization/state/role.store.ts`: Added `loadRolesOnly()` method using `getRoles()` without calling `/permissions`.
- `src/app/modules/organization/state/position.store.ts`: Added access state signals (`accessTemplate`, `accessLoading`, `accessSaving`, `accessError`, `selectedAccessPosition`) and store methods (`loadAccess`, `setPositionAccess`, `clearAccess`).
- `src/app/modules/organization/state/department.store.ts`: Added defensive array checks in tree flattener.

### UI Components & Modals
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.ts`: Updated option labels (`"Root Position"`, `"No system role"`).
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.html`: Updated section title to `"System access"`.
- `src/app/modules/organization/ui/position-access-modal/position-access-modal.component.ts` (NEW): Modal component for viewing and editing position access templates.
- `src/app/modules/organization/ui/position-list-table/position-list-table.component.ts` & `.html`: Added `@Input() canConfigureAccess` and gated Position Access 3-dot menu item.
- `src/app/modules/organization/ui/position-tree-node/position-tree-node.component.ts` & `.html`: Added `@Input() canConfigureAccess` and gated Position Access 3-dot menu item.

### Feature Orchestration
- `src/app/modules/organization/feature/position-management/position-management.component.ts`: Injected `RoleStore`, computed `canConfigureAccess`, orchestrated two-step save flow (`createPosition` followed by `setPositionAccess`), handled partial failure warning toasts, and enforced permission gating on `openAccessModal` and `onSaveAccess`.
- `src/app/modules/organization/feature/position-management/position-management.component.html`: Bound `[canConfigureAccess]="canConfigureAccess()"`.
- `src/app/modules/organization/feature/position-management/position-management.component.spec.ts`: Added integration tests including dual-permission gating tests.

---

## 5. Two-Step Save & Partial Failure Behavior
1. **Step 1**: Frontend calls `POST /api/v1/org/legal-entities/{id}/positions` with base position fields.
2. **Step 2**: If position creation succeeds AND a default system access role was selected, frontend calls `PUT /api/v1/org/legal-entities/{id}/positions/{posId}/access`.
3. **Full Success**: When both calls succeed, a success toast is displayed (`"Position created with system access."` or `"Position created."`).
4. **Partial Failure**: If position creation succeeds but `PUT access` fails:
   - Created position is retained in state and UI (no rollback).
   - Warning toast is displayed: `"Position was created, but system access was not saved. You can update access from Position Access."`
   - Full success toast wording is suppressed.
5. **Create Failure**: If `POST createPosition` fails, an error toast is shown, and `setPositionAccess` is not called.

---

## 6. Verification & Test Results
- **Unit & Integration Tests**: Executed `npx ng test --no-watch`.
  **Result**: `79 test files passed (79) | 439 tests passed (439) | Exit Code 0`.
- **Production Build**: Executed `npm run build`.
  **Result**: `Application bundle generation complete (Exit Code 0)`.
- **Git Diff & Whitespace Verification**: Executed `git diff --check`.
  **Result**: `Exit Code 0` (no trailing whitespace or diff errors).

---

## 7. Skipped Checks & Remaining Risks
- **Backend Changes**: None made (strictly avoided editing backend per instructions).
- **Git Commit/Push**: Skipped per explicit instructions (working tree changes preserved uncommitted).
- **Backend API Runtime Integration**: Verified via Angular HTTP testing controller mocks matching the exact C# contract in `PositionsController.cs`. E2E integration against a live backend instance requires backend service availability.
