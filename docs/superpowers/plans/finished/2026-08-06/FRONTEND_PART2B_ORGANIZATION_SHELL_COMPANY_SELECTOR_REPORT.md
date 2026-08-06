# Frontend Part 2B Report — Organization Shell, Sub-Sidebar, Company Selector, & Selected Legal Entity State

> **Scope:** Frontend Part 2B only.  
> **Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`  
> **Target Branch:** `Development`  
> **Date:** August 2026  

---

## 1. Executive Summary

Part 2B establishes the Organization navigation foundation and company context state needed before building Department, Position, and Legal Entity screens.

Key achievements:
- **Organization Routes & Shell:** Added lazy-loaded Organization routes (`/organization`, `/organization/departments`, `/organization/positions`) with default redirect from `/organization` to `/organization/departments`.
- **Organization Sub-Sidebar:** Configured Organization sub-sidebar navigation in `NAV_ITEMS` with `Departments` and `Positions`.
- **Selected Legal Entity State:** Implemented central `LegalEntityStore` (`@ngrx/signals`) storing `selectedLegalEntityId` and `selectedLegalEntity`. Initialized from primary/first company, validated against persisted `localStorage` (`onevo.selected_legal_entity_id`), falling back to first available company if invalid.
- **Topbar Company Selector:** Built accessible, theme-responsive `CompanySelectorComponent` rendered in `TopNavbarComponent`. Displays current company name with caret dropdown showing Current Company, Other Companies, and Add Company (emitting placeholder action).
- **Backend Alignment:** Uses actual backend route `GET /api/v1/org/legal-entities?includeInactive=` (`LegalEntitiesController.cs:29-37`).
- **Permission Compliance:** Uses `PermissionService` (`org_structure` module AND `org:read` / `org:manage` permission). No role name checks.

---

## 2. Backend Endpoint Reference & Permissions

| Functionality | Backend Route | Source File & Lines | Permission Required |
|---|---|---|---|
| **Legal Entity List** | `GET /api/v1/org/legal-entities?includeInactive={bool}` | `HRMS-Backend-v1/src/ONEVO.Api/Controllers/Tenant/OrgStructure/LegalEntitiesController.cs` (lines 29-37) | `org:read` |

**DTO Shape:**
`LegalEntityListItemResponse` (`HRMS-Backend-v1/src/ONEVO.Application/Features/OrgStructure/LegalEntity/DTOs/Responses/LegalEntityListItemResponse.cs`):
```json
{
  "id": "guid-string",
  "name": "OneVo Technologies",
  "companyCode": "OVT",
  "logoFileId": null,
  "isActive": true,
  "isPrimary": true
}
```

---

## 3. Architecture & File Changes

### A. New Files Created
1. `src/app/modules/organization/models/legal-entity.model.ts`
   - Data interface for legal entity list items matching backend `LegalEntityListItemResponse`.
2. `src/app/modules/organization/data-access/legal-entity-api.service.ts`
   - Angular service wrapping `GET /api/v1/org/legal-entities`.
3. `src/app/modules/organization/data-access/legal-entity-api.service.spec.ts`
   - Unit tests for `LegalEntityApiService`.
4. `src/app/modules/organization/state/legal-entity.store.ts`
   - NgRx Signal Store managing `companies`, `selectedLegalEntityId`, `loading`, `error`, and `loaded`.
   - Computed signals: `selectedLegalEntity`, `activeCompanies`, `otherCompanies`.
   - `localStorage` persistence key: `'onevo.selected_legal_entity_id'`.
5. `src/app/modules/organization/state/legal-entity.store.spec.ts`
   - Unit tests for `LegalEntityStore` state, initial selection, persistence, fallback, and company switching.
6. `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.ts`
   - Topbar component presenting current company trigger and popover dropdown.
7. `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.html`
   - Template for company selector with Current Company, Other Companies, and Add Company sections.
8. `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.css`
   - Theme-responsive styles using CSS design tokens (`var(--color-surface)`, `var(--color-text-primary)`, `var(--color-border)`, `var(--color-accent)`).
9. `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.spec.ts`
   - Unit tests for company selector rendering, access gating, company selection, and Add Company action.
10. `src/app/modules/organization/organization.routes.ts`
    - Routes config for lazy-loaded Organization module routes.
11. `src/app/modules/organization/organization.routes.spec.ts`
    - Route tests verifying `/` redirects to `/departments`.
12. `src/app/modules/organization/feature/departments-placeholder/departments-placeholder.component.ts`
    - Minimal placeholder page for `/organization/departments` using `PageHeaderComponent` & `EmptyStateComponent`.
13. `src/app/modules/organization/feature/positions-placeholder/positions-placeholder.component.ts`
    - Minimal placeholder page for `/organization/positions` using `PageHeaderComponent` & `EmptyStateComponent`.
14. `FRONTEND_PART2B_ORGANIZATION_SHELL_COMPANY_SELECTOR_REPORT.md`
    - Deliverable report document.

### B. Existing Files Modified
1. `src/app/app.routes.ts`
   - Updated `/organization` route to lazy load `ORGANIZATION_ROUTES` via `loadChildren`.
2. `src/app/layouts/main-layout/nav/nav-items.config.ts`
   - Updated `organization` nav item children to contain `Departments` and `Positions`.
3. `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`
   - Added unit test asserting Organization sub-sidebar renders `Departments` and `Positions`.
4. `src/app/layouts/main-layout/top-navbar/top-navbar.component.ts`
   - Imported `CompanySelectorComponent`.
5. `src/app/layouts/main-layout/top-navbar/top-navbar.component.html`
   - Added `<app-company-selector />` on left side of topbar.
6. `src/app/layouts/main-layout/top-navbar/top-navbar.component.css`
   - Added flex `space-between` layout for left and right topbar sections.
7. `src/app/layouts/main-layout/top-navbar/top-navbar.component.spec.ts`
   - Provided testing imports for topbar specs.
8. `src/app/shared/ui/popover/popover.component.ts` & `popover.component.css`
   - Added `align="left" | "right"` input and `.app-popover__panel--align-left` styling for topbar popovers.
9. `src/app/core/services/notification.service.ts`
   - Added `info(message: string)` notification method.

---

## 4. Sub-Sidebar & Navigation Rules

- **Visibility:** Organization item in main sidebar and sub-sidebar items (`Departments`, `Positions`) are shown only when:
  - `active_modules` includes `org_structure`
  - AND permissions include `org:read` or `org:manage`
- **Active State:** Derived from active router URL (`/organization/departments` or `/organization/positions`).
- **No Role Checks:** All visibility checks use `PermissionService` checking `activeModules` and `permissions` arrays.

---

## 5. Verification Results

### Unit Test Execution
- **Command:** `npm test -- --watch=false`
- **Result:** **PASSED (201 passed across 47 test suites, 0 failed)**

### Production Build
- **Command:** `npm run build`
- **Result:** **PASSED (Application bundle generation complete)**

### Staging Build
- **Command:** `npm run build:staging`
- **Result:** **PASSED (Application bundle generation complete)**

### Git Diff Check
- **Command:** `git diff --check`
- **Result:** **Clean (code 0, no trailing whitespace or whitespace errors)**

---

## 6. Scope Confirmation & Deferred Features

- **Backend (`C:\onevoNew\HRMS-Backend-v1`):** Untouched.
- **Postman Collections:** Untouched.
- **OneVo-HR Documentation:** Untouched.
- **Git Commit / Push:** None executed.
- **Deferred to Part 2C+:**
  - Legal Entity General Settings form (Part 2C)
  - Create Company modal (Part 2D)
  - Delete Company modal (Part 2E)
  - Department tree/list management & CRUD (Part 2F)
  - Position CRUD & tree management (Part 2G)
  - Department head position selection (Part 2H)
