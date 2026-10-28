# Clock-in Policy Frontend — Part 2B Report

## Summary

Part 2B removes the inactive-policies list toggle and adds create/edit routes plus a full settings form for core Clock-in Policy fields. Create/update are wired to legal-entity Attendance endpoints. Late deduction rule editing is intentionally out of scope; existing rules are preserved on update. Device/outage/fallback UI was not implemented or referenced.

No backend changes. No commit/push.

## Pre-change inspection

- `git status --short --branch` on `feature/employee-management-phase1-foundation` (unrelated WIP present).
- Architecture: `ONEVO_HRMS_Frontend_Architecture.md`.
- Part 2A: `CLOCK_IN_POLICY_FRONTEND_PART2A_REPORT.md` + settings list/store/API/models.
- Backend: Part 1 report, `UpsertClockInPolicyRequest`, `ClockInPolicyResponse`, `LegalEntityClockInPoliciesController`.
- Update handler clears and replaces `LateDeductionRules` from the request body — edit must preserve existing rules or they are deleted.
- Form patterns: General Settings (sections/card layout, `app-input` / `app-select` / notifications).
- Department/position pickers: `DepartmentApiService.listFlat` / `PositionApiService.listFlat` (same pattern as checklist builder / add-employee wizard).
- Employee list API exists (`PeopleApiService`), but no dedicated multi-select employee picker UI — Employee scope left disabled.

## Route paths

| Path | Page | Permission |
|:-----|:-----|:-----------|
| `/settings/clock-in-policy` | List | `attendance:read` + module `time_attendance` |
| `/settings/clock-in-policy/new` | Create | `attendance:write` + module `time_attendance` |
| `/settings/clock-in-policy/:id/edit` | Edit | `attendance:write` + module `time_attendance` |

Routes are nested under a componentless `clock-in-policy` parent in `app.routes.ts` (Settings style).

## Files changed / added

### Added
- `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.ts`
- `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.html`
- `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.css`
- `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts`
- `src/app/modules/settings/utils/clock-in-policy-form.utils.ts`
- `src/app/modules/settings/utils/clock-in-policy-form.utils.spec.ts`
- `CLOCK_IN_POLICY_FRONTEND_PART2B_REPORT.md` (this file)

### Updated
- `src/app/app.routes.ts` — create/edit child routes
- `src/app/modules/settings/feature/clock-in-policy-list/*` — remove inactive toggle; enable Create/Edit
- `src/app/modules/settings/state/clock-in-policy.store.ts` (+spec) — detail/create/update state; drop `includeInactive` UI state
- `src/app/modules/settings/data-access/clock-in-policy-api.service.spec.ts` — hybrid payload / CSRF regression checks

## UI sections implemented

1. **Policy details** — name, effective from/to, Active/Inactive status
2. **Applies to** — Company / Department / Position (Employee disabled)
3. **Location verification** — require verification + radius meters
4. **Clock-in methods** — Onsite, Remote, **Hybrid**, Field cards
5. **Attendance corrections** — approval toggle; fixed Management coverage owner recipient
6. **Late deduction rules** — informational only (not editable)

## Exact API endpoints used

Base: `{environment.apiUrl}/attendance/legal-entities/{legalEntityId}/clock-in-policies`
(`environment.apiUrl` already includes `/api/v1`)

| Action | Method | Endpoint |
|:-------|:-------|:---------|
| List (active only) | GET | `.../clock-in-policies?includeInactive=false` |
| Get detail | GET | `.../clock-in-policies/{id}` |
| Create | POST | `.../clock-in-policies` |
| Update | PUT | `.../clock-in-policies/{id}` |

No hardcoded localhost URLs. No manual CSRF headers (interceptors only).

## Permission behavior

| Control | Gate |
|:--------|:-----|
| List route / content | `attendance:read` + `time_attendance` |
| Create button | `attendance:write` → `/settings/clock-in-policy/new` |
| Edit row action | `attendance:write` → `/settings/clock-in-policy/{id}/edit` |
| Create/edit routes | `attendance:write` + `time_attendance` |
| Missing company | List: Select a company to view… / Form: Select a company to manage clock-in policies. |

## Hybrid display and mapping

- UI label: **Hybrid** (never “Either”).
- Payload path: `workAreaRules.hybrid`.
- Source rule labels → API: Onsite → `onsite`, Remote → `remote`, Employee choice → `employee_choice`.
- Field photo labels → API: Off → `off`, Optional → `optional`, Required → `required`.
- Scope UI: Company → `full_company`, Department → `department`, Position → `position`.

## Confirmations

| Requirement | Status |
|:------------|:-------|
| “Either” not exposed in UI | Confirmed (tests assert absence) |
| Inactive toggle removed | Confirmed; list always `includeInactive=false` |
| Device / outage / fallback not implemented or referenced | Confirmed (tests assert forbidden words) |
| Late deduction editing not implemented | Confirmed |

## Late deduction decision and reason

**Decision:** Show a disabled informational section. Create sends `lateDeductionRules: []`. Edit **preserves** existing rules in the PUT payload (maps `lateArrivalMinute`, `multiplier`, `timeOffTypeId` only).

**Reason:** Backend `UpdateClockInPolicyCommandHandler` clears the collection and re-adds from the request. Sending `[]` on edit would silently delete rules. Time Off types are not available, so editable UI was not built. No fake `timeOffTypeId` values are invented.

## Store behavior (Part 2B)

State: `policies`, `loadingPolicies`, `policiesError`, `selectedPolicy`, `loadingSelectedPolicy`, `selectedPolicyError`, `saving`, `saveError`.

Methods: `loadPolicies`, `loadPolicy`, `createPolicy`, `updatePolicy`, `clear`, `clearSelectedPolicy`.

After successful create/update: toast (`Clock-in policy created.` / `Clock-in policy updated.`), navigate to list, invalidate `loadedKey` and refresh list.

Friendly errors only: list/detail/save fallbacks — never raw backend messages.

## Employee scope

Shown as a **disabled** segmented option with helper text:
`Employee-specific policies need an employee picker before they can be configured.`
Not submittable.

## Tests run

| Check | Result |
|:------|:-------|
| `npx ng test --no-watch --include src/app/modules/settings/**/*.spec.ts` | **61 passed** |
| `npm run build` | Passed (pre-existing style-budget / CommonJS warnings unrelated) |
| `git diff --check` (Part 2B paths) | Clean |

## Skipped checks and why

1. **E2E / Playwright** against live backend — out of Part 2B unit scope.
2. **Archive/restore UI** — deferred (service methods remain from Part 2A).
3. **Employee scope picker** — no existing multi-select employee picker pattern inspected as safe for this form.
4. **Late deduction rule editor** — blocked on missing `time_off_types`.

## Remaining risks

1. Position picker loads first page (`pageSize: 100`); large orgs may need search/pagination later.
2. Policies with existing late rules can be edited for other fields; rules are preserved but still not user-visible as editable rows.
3. Employee-scoped policies created via API cannot be fully reconfigured in UI until a picker ships.
4. Overlap conflicts from backend still surface only as the generic save error toast (no field-level conflict copy yet).

## Explicit exclusion confirmation

Not implemented, linked, or displayed:

- biometric outage fallback
- device outage fallback
- attendance device management
- affected device
- temporary fallback windows
- fallback status/resolution
- any fallback note/link
