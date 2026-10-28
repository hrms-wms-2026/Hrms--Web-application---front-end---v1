# Employee Detail Screen — Frontend Design

**Status:** Approved by user 2026-08-16, ready for implementation planning.

**Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-16-employee-detail-screen-backend-design.md` (backend half — this document is the frontend consumer of that API).

**Origin:** brainstormed live with the user 2026-08-16, grounded in the existing `EmployeeDetailComponent` (already documented as a deliberate stub — see its own doc comment and `EMPLOYEE_MANAGEMENT_FRONTEND_IMPLEMENTATION_REPORT.md`'s "Known gap: detail page" section) and the `people` module's existing conventions.

## 1. Goal

Replace `EmployeeDetailComponent`'s single flat `<dl>` with a section-by-section detail view: Job Information, Personal Information, Emergency Contacts, and — shown only when the backend includes it in the response — Payroll & Statutory. Add a "Change Position" action.

## 2. Current-state facts this design depends on

- `EmployeeDetailComponent` (`modules/people/feature/employee-detail/employee-detail.component.ts`) currently calls `PeopleApiService.getEmployee(id)` → `GET /api/v1/employees/{id}`, typed as `EmployeeListItemResponse` (the same shape used by the list). The backend spec adds a **new**, separate `GET /api/v1/employees/{id}/detail` endpoint — this component switches to calling that instead; the plain `getEmployee`/`EmployeeListItemResponse` call stays as-is for any other caller (none currently exist besides this component, per `people-api.service.ts`'s doc comment, but the backend intentionally didn't repurpose the existing endpoint — see backend spec §4).
- `people-api.service.ts` already has `resendInvitation(id)` wired and used by this component — unchanged, reused as-is.
- Permission gating pattern: `*appHasPermission="'code'"` structural directive (`shared/directives/has-permission.directive.ts`), backed by `PermissionService.hasPermission`/`hasAnyPermission`. **Not needed for the Payroll section** — the backend omits the `payroll` field entirely when the caller lacks `employees:read:sensitive`, so `@if (employee.payroll)` is the correct, simpler, backend-authoritative check (matches how `payroll.canEdit` already works in the self-service Profile popup, per the 2026-08-15 frontend spec).
- Route permission data (`data: { permissions: ['employees:read','employees:write'] }`) on `/people/employees/:id` in `people.routes.ts` is unchanged — both read and write actions on this page already require being on this route in the first place.

## 3. Sections

Mirrors the backend response shape 1:1, no client-side data transformation beyond display formatting:

- **Job Information** — employee number, legal entity, department, position, reporting manager, employment type, status, hire date, probation end date. (Today's minimal `<dl>` already renders most of this — this section absorbs it.)
- **Personal Information** — name, email, phone, date of birth, gender, addresses.
- **Emergency Contacts** — list (name, relationship, phone, email, primary flag). Read-only — no add/edit/delete from this screen (that's the employee's own self-service surface, unchanged, out of scope here).
- **Payroll & Statutory** — shown only when `employee.payroll` is present in the response: bank name, masked account number, account type. Read-only, no edit action here either (bank-detail editing stays self-service-only per the 2026-08-15 decision, unchanged).

Each section is its own presentational sub-component under `ui/` (`employee-job-info.component.ts`, `employee-personal-info.component.ts`, `employee-emergency-contacts.component.ts`, `employee-payroll.component.ts`) taking its slice of the response as an `input()`, consistent with this module's existing `feature`/`ui` split (`employee-table.component.ts` is the precedent for a presentational, `OnPush`, no-direct-API-access sibling).

## 4. Change Position action

A "Change Position" button (visible only when `*appHasPermission="'employees:write'"`, matching the write-gating pattern used elsewhere in this module) opens a small modal: a position dropdown (reusing the existing `organization` module's `PositionApiService`, same reuse pattern `add-employee-wizard.store.ts` already established for department/position dropdowns) scoped to the employee's own legal entity, plus an effective-date field defaulting to today. Submits to the new `POST /api/v1/employees/{id}/change-position`. On success, reloads the detail view (same `load()` re-fetch pattern the existing `resendInvitation` handler already uses). On a 409 (capacity full), shows the backend's message via the existing `toSafeErrorMessage`/`NotificationService.error` pattern — no custom capacity-specific UI, consistent with how every other error on this page is already handled.

## 5. Out of scope

Dependents, Security, Documents, Lifecycle sections — no backend surface (see backend spec §2), not built here. Editing Personal Information/Emergency Contacts from the admin view — read-only for now, matches "no admin edit endpoints exist yet" from the backend spec. A full approval-routed Promotion/Transfer workflow — this is the minimal reassignment version only, per explicit user decision during brainstorming.

## 6. Testing

Component spec for each new `ui/` sub-component (render given input, no API calls — matches `employee-table.component.spec.ts`'s existing pattern). `EmployeeDetailComponent` spec: loading/error/loaded states (existing coverage extended, not replaced), Payroll section present/absent based on response shape, Change Position modal open/submit/success-reload/409-error-toast paths.

## 7. Self-review

- No placeholders — every section traces directly to the backend spec's response shape.
- Scope: deliberately matches the backend's exclusions rather than building UI for data that doesn't exist server-side.
