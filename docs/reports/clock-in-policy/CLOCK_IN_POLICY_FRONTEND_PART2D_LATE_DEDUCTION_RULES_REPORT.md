# Clock-in Policy Frontend — Part 2D Late Deduction Rules Report

## Summary

Part 2D adds the **Late deduction rules** section to the existing single company-wide Clock-in Policy settings screen.

Because **no real Time Off Type lookup API exists in the frontend**, the section is **disabled** with HR-facing copy. Saving other clock-in settings still **preserves** existing backend `lateDeductionRules` on update and sends `[]` on create.

Editable rule UI, validation, sorting, and payload mapping are implemented and covered by tests (gated behind `LATE_DEDUCTION_RULES_EDITABLE` / `lateRulesEditable`), ready to enable when a real Time Off Type lookup is wired.

No backend changes. No commit/push.

## Pre-change inspection

1. `git status --short --branch` on `feature/employee-management-phase1-foundation` (unrelated WIP present).
2. Read:
   - `ONEVO_HRMS_Frontend_Architecture.md`
   - `OneVo-HR/database/phase1-table-inventory.md` (`time_off_types`, `clock_in_late_deduction_rules`)
   - Existing settings Clock-in Policy files under `src/app/modules/settings`
   - Part 2C single-screen correction report
3. Verified Time Off Type availability from **frontend code only** (no guessing).

## Time Off Type lookup — verification result

| Check | Result |
|:------|:-------|
| `src/app` Time Off / Leave module API services | **None** |
| `timeOffType` / `TimeOffType` / leave-type API clients | **None** |
| `api-endpoints.ts` time-off type routes | **None** |
| Nav `/time-off` | Placeholder route only (`loadPlaceholder`) |
| Existing settings/clock-in services exposing type lookup | **No** |

**Decision:** Do not invent an endpoint or hardcode leave types.  
`LATE_DEDUCTION_RULES_EDITABLE = false`.

Disabled UI message:

> Time off types must be configured before late deduction rules can be added.

### Backend follow-up (required to enable editing)

Expose a tenant/legal-entity Time Off Type list API that the frontend can call (active types only), for example under a future Time Off module:

- Suggested contract shape: `{ id, name, … }` active types suitable for a dropdown
- Frontend then: add `data-access` service + store/load into `timeOffTypeOptions`, set `LATE_DEDUCTION_RULES_EDITABLE = true`

Until that exists, production UI stays disabled and update payloads preserve backend rules.

## What was implemented

### UI (same Settings → Clock-in Policy screen)

1. Section title: **Late deduction rules**
2. When lookup unavailable (current production path):
   - Disabled helper message (above)
   - No Add/Remove, no fake dropdowns
3. When editing enabled (tests / future):
   - Rows: “If late by [minutes] minutes, deduct [amount] from [time off type]”
   - **Add rule** / **Remove**
   - Field-level validation before Save
   - Rules sorted by late arrival minutes before submit

### Payload mapping (`lateDeductionRules`)

| Mode | Create | Update |
|:-----|:-------|:-------|
| Editing **disabled** (current) | `[]` | Preserve existing backend rules (`lateArrivalMinute`, `multiplier`, `timeOffTypeId`) |
| Editing **enabled** | Sorted user-entered rules | Sorted user-entered rules |

Form → API field map when editable:

| UI | Payload |
|:---|:--------|
| late arrival minutes | `lateArrivalMinute` |
| deduction amount | `multiplier` |
| time off type | `timeOffTypeId` |

Company-wide hidden fields unchanged from Part 2C:

- `scope.type = full_company`, empty scope ID arrays
- Internal `name` / `effectiveFrom` / `effectiveTo`
- `correctionRequiresApproval`, `notificationRecipientResolver`
- `isActive = true`
- Hybrid `sourceRule = employee_choice`

### Validation (when editable)

- Minutes required; integer ≥ 1
- Deduction amount required; > 0
- Time off type required
- Duplicate minute thresholds blocked
- Field-level errors shown on Save attempt (no wait for backend 400)

## Exact files changed

| Path | Change |
|:-----|:-------|
| `src/app/modules/settings/utils/clock-in-policy-form.utils.ts` | Late-rule form model, validation, sort, payload preserve/edit paths |
| `src/app/modules/settings/utils/clock-in-policy-form.utils.spec.ts` | Utils coverage for late rules |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.ts` | Section logic, add/remove/patch, editable gate |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.html` | Late deduction rules section markup |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.css` | Late-rule row layout |
| `src/app/modules/settings/feature/clock-in-policy-form/clock-in-policy-form.component.spec.ts` | UI + payload + disabled/editable tests |
| `src/app/modules/settings/state/clock-in-policy.store.ts` | `saveCompanyPolicy(..., lateRulesEditable)` |
| `CLOCK_IN_POLICY_FRONTEND_PART2D_LATE_DEDUCTION_RULES_REPORT.md` | This report |

Unchanged contracts: `clock-in-policy.model.ts`, `clock-in-policy-api.service.ts` (still list/get/create/update only).

## Copy restrictions confirmed

Not shown:

- “Late deduction setup will be added after Time Off types are available.”
- Policy details / Policy name / Effective from / Effective to / Applies to
- Attendance corrections / Source rule / Show inactive policies / Create policy / Edit policy

Shown where appropriate:

- Clock-in Policy, Clock-in methods, Late deduction rules
- (Editable path) If late by, minutes, deduct, time off type, Add rule, Remove

## Tests run

| Check | Result |
|:------|:-------|
| `npx ng test --no-watch --include src/app/modules/settings/**/*.spec.ts` | **52 passed** |
| `npm run build` | Passed (pre-existing style-budget / CommonJS warnings; clock-in form CSS near budget) |
| `git diff --check` (settings + this report) | Clean |

Covered behaviors include: section render, no old placeholder, disabled path + preserve on update, add/remove when editable, invalid minutes/amount/duplicates blocked, sort before submit, dropdown uses injected lookup options when editable, company-wide payload / no scope UI, forbidden labels absent.

## Skipped checks

1. **E2E / Playwright** against live backend.
2. **Live Time Off Type API integration** — endpoint does not exist in frontend; no invented client.
3. **Enabling `LATE_DEDUCTION_RULES_EDITABLE` in production** — blocked until real lookup exists.

## Remaining risks

1. Orgs can still have late rules in the DB that users cannot view/edit until Time Off Type lookup ships.
2. Backend Update still replaces the full `lateDeductionRules` collection — preserve-on-update path remains critical while editing is disabled.
3. Multiple active `full_company` policies still block the whole settings screen (Part 2C behavior).

## Confirmations

| Requirement | Status |
|:------------|:-------|
| Work only in frontend repo settings Clock-in Policy | Confirmed |
| No backend edited | Confirmed |
| No fake Time Off Type dropdown / invented endpoint | Confirmed |
| No separate create/edit or policy list reintroduced | Confirmed |
| No commit / push | Confirmed |
