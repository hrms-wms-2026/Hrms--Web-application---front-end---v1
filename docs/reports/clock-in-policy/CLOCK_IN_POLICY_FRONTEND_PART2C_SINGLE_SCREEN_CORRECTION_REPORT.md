# Clock-in Policy Frontend — Part 2C Single-Screen Correction Report

## Summary

Part 2C corrects the Part 2B create/edit multi-policy UX into a **single company-wide settings screen**.

User flow is now:

**Settings → Clock-in Policy → configure methods → Save changes**

Users no longer create, name, schedule, or scope multiple policy records in the UI.

No backend changes. No commit/push.

## Why Part 2B was corrected

Part 2B shipped a list + create/edit form mental model (`/new`, `/:id/edit`, policy metadata, scope pickers, corrections, location verification section, source rule, field photo dropdown). That conflicted with the product intent: one company-wide clock-in settings page.

Part 2C removes that CRUD surface and maps the same legal-entity Attendance APIs to a single settings experience behind the scenes (POST if none, PUT if one active `full_company` policy).

## Pre-change inspection

- `git status --short --branch` on `feature/employee-management-phase1-foundation` (unrelated WIP present).
- Architecture: `ONEVO_HRMS_Frontend_Architecture.md`.
- Part 2A / 2B reports and then-current settings implementation.
- Backend contracts: `UpsertClockInPolicyRequest`, `LegalEntityClockInPoliciesController`, `ClockInPolicyResponse`.
- Backend remains sufficient — no frontend blocker requiring backend change.

## Files changed

### Added / rewritten (settings domain)

| Path | Role |
|:-----|:-----|
| `src/app/modules/settings/feature/clock-in-policy-form/*` | Single settings screen (title, method cards, Save) |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy.routes.spec.ts` | Route gate + legacy redirect assertions |
| `src/app/modules/settings/state/clock-in-policy.store.ts` (+spec) | Company settings store (`loadCompanyPolicy` / `saveCompanyPolicy`) |
| `src/app/modules/settings/utils/clock-in-policy-form.utils.ts` (+spec) | Settings form value + upsert mapping |
| `src/app/modules/settings/data-access/clock-in-policy-api.service.ts` (+spec) | list/get/create/update only |
| `src/app/modules/settings/models/clock-in-policy.model.ts` | Unchanged contract models (still used) |
| `CLOCK_IN_POLICY_FRONTEND_PART2C_SINGLE_SCREEN_CORRECTION_REPORT.md` | This report |

### Updated

| Path | Change |
|:-----|:-------|
| `src/app/app.routes.ts` | `/settings/clock-in-policy` loads settings form; `new` / `:id/edit` redirect to it |
| `src/app/layouts/main-layout/nav/nav-items.config.ts` | Nav → `/settings/clock-in-policy` (unchanged path/gates) |

### Removed

| Path | Reason |
|:-----|:-------|
| `feature/clock-in-policy-list/*` | List/table primary UI removed (folder already absent / not reintroduced) |
| `utils/clock-in-policy-display.utils.ts` (+spec) | List-only display helpers no longer used |
| API `archive` / `restore` methods | Dead for this settings screen |

## Routes removed / redirected

| Path | Behavior |
|:-----|:---------|
| `/settings/clock-in-policy` | Settings form (primary) |
| `/settings/clock-in-policy/new` | `redirectTo: ''` |
| `/settings/clock-in-policy/:id/edit` | `redirectTo: ''` |

Redirects kept to avoid routing risk from bookmarked Part 2B URLs. No visible create/edit links remain.

Route gate: `attendance:read` + module `time_attendance`.

## UI sections removed

- Create policy / Edit
- Policy details (name, effective from/to, status)
- Applies to / scope selector (Company / Department / Position / Employee)
- Attendance corrections / Corrections require approval / Notification recipient
- Source rule
- Separate Location verification section / Require location verification / Allowed radius in meters
- Late deduction rules note/section
- Show inactive policies / Archive / Restore
- Field photo dropdown (`optional` not exposed)
- Either / outage / fallback / device wording

## Final UI sections kept

1. **Title:** Clock-in Policy  
2. **Subtitle:** Control how employees can clock in for this company.  
3. **Primary action:** Save changes (write users only)  
4. **Clock-in methods** — four cards:
   - **Onsite** — Biometric, Web/app, Desktop tray, Photo required  
   - **Remote** — same  
   - **Hybrid** — same + Location check required + Allowed distance (meters) when checked  
   - **Field** — Biometric, Web/app, Desktop tray, Photo required (checkbox)

Company empty state: `Select a company to manage clock-in policy.`

## Backend-required hidden fields

Set internally on every save:

| Field | Create | Update |
|:------|:-------|:-------|
| `name` | `Default clock-in policy` | Preserve existing |
| `effectiveFrom` | Today (local `yyyy-MM-dd`) | Preserve existing |
| `effectiveTo` | `null` | Preserve existing |
| `scope.type` | `full_company` | Forced `full_company` |
| `departmentIds` / `positionIds` / `employeeIds` | `[]` | `[]` |
| `isActive` | `true` | `true` |
| `correctionRequiresApproval` | `true` | `true` |
| `notificationRecipientResolver` | `management_coverage_owner` | `management_coverage_owner` |
| `lateDeductionRules` | `[]` | Preserve existing exactly |
| `workAreaRules.hybrid.sourceRule` | `employee_choice` | Always `employee_choice` |

## Company-wide policy mapping

Uses:

`GET /api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies?includeInactive=false`

Then filters active `scopeType === "full_company"`:

| Matches | Behavior |
|:--------|:---------|
| 0 | Default form → Save **POST** |
| 1 | Load detail via GET → Save **PUT** |
| 2+ | Blocking error: *Clock-in policy needs admin review because more than one company-wide policy exists.* Save disabled. No guess. |

No legalEntityId → no API call.

## Hybrid location mapping

| UI | Payload |
|:---|:--------|
| Location check required **checked** | `workAreaRules.hybrid.locationCheckRequired = true`, `locationVerificationRequired = true`, `allowedRadiusMeters = <positive integer>` |
| **Unchecked** | `locationCheckRequired = false`, `locationVerificationRequired = false`, `allowedRadiusMeters = null` |

Allowed distance visible/enabled only when location check is checked; required positive integer when checked.

## Field photo checkbox mapping

| Checkbox | `photoRequirement` |
|:---------|:-------------------|
| Checked | `"required"` |
| Unchecked | `"off"` |

`"optional"` is not exposed in UI (existing optional values normalize to off when loaded into the form).

## Permission behavior

| Surface | Gate |
|:--------|:-----|
| Nav / route | `time_attendance` + `attendance:read` |
| View settings | Read-only when missing `attendance:write` (checkboxes disabled) |
| Save changes | Shown only with `attendance:write` (+ module already required for route) |

## Store refactor

State:

- `policy`, `loading`, `saving`, `error`, `saveError`, `multipleCompanyPolicies`
- Internal dedupe: `legalEntityId`, `inFlightKey`, `loadedKey`

Methods:

- `loadCompanyPolicy(legalEntityId)`
- `saveCompanyPolicy(legalEntityId, formValue)`
- `clear()`

## Tests run

| Check | Result |
|:------|:-------|
| `npx ng test --no-watch --include src/app/modules/settings/**/*.spec.ts --include src/app/layouts/main-layout/nav/nav-access.spec.ts` | **49 passed** |
| `npm run build` | Passed (pre-existing style-budget / CommonJS warnings unrelated) |
| `git diff --check` (Part 2C paths) | Clean |

## Skipped checks

1. **E2E / Playwright** against live backend — out of Part 2C unit scope.
2. **Admin tooling** to resolve multiple company-wide policies — intentionally blocked in UI only.
3. **Late deduction rule editor** — still out of scope; rules preserved on update.

## Remaining risks

1. Orgs with multiple active `full_company` policies need backend/admin cleanup before Save works.
2. Department/position/employee-scoped policies may still exist via API but are invisible on this screen (by design).
3. Existing `photoRequirement: "optional"` loads as unchecked (`off`) if the user saves without intending to change Field photo.

## Confirmations

| Requirement | Status |
|:------------|:-------|
| No backend changed | Confirmed |
| No device / outage / fallback UI | Confirmed (tests assert absence) |
| No “Either” UI | Confirmed (tests assert absence) |
| No commit / push | Confirmed |
