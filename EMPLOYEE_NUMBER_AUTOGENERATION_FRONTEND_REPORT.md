# Employee Number Autogeneration — Frontend Report

**Repo:** `Hrms--Web-application---front-end---v1`  
**Date:** 2026-08-20  
**Scope:** Add Employee Step 1 auto-fill, live availability hint, payload wiring

## Uniqueness scope and evidence

Frontend treats uniqueness as **tenant-wide**, matching backend:

- Calls `GET /api/v1/onboarding/employee-number-availability` (tenant derived server-side).
- UI “Available” is a **live hint only**; Continue/Save/Finalize still send the current form value; backend re-checks and can return 409 on race.

## Endpoint contracts (consumed)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/onboarding/employee-number-suggestion?legalEntityId=` | Suggested default when company selected |
| GET | `/api/v1/onboarding/employee-number-availability?employeeNumber=` | Debounced availability after HR edits |

No `tenantId` is sent.

## Generated format

Expected suggestion shape: `{COMPANY_CODE}-{0001}` (backend-authored).  
Client validation mirror: letters/digits/hyphen/underscore, max 20, no spaces; case preserved.

Friendly copy:

- “This employee number is already in use.”
- “Employee number can only contain letters, numbers, hyphens, and underscores.”
- “Could not generate an employee number. Enter one manually.”
- Hint: “Available” / “Checking…”

## Behavior

1. When legal entity/company is selected and employee number is empty **or** still equals the last suggestion → fetch suggestion and fill the editable input.
2. Manual edits are **not** overwritten when company changes.
3. Edits debounce (~350ms) into availability check; unavailable/invalid/`checking` blocks Continue / Save Draft / Finalize.
4. Draft save/finalize payload uses the **current** form `employeeNumber` (via existing store sync).
5. Resumed drafts with an existing number mark provisional “available”; finalize still authoritative. Blank resumed numbers await suggestion before continuing.

## Files changed

| Path | Change |
|------|--------|
| `people-api.service.ts` (+ spec) | Suggestion + availability clients |
| `onboarding-draft.model.ts` | Response types |
| `utils/employee-number.utils.ts` (+ spec) | Shared format helpers/messages |
| `add-employee-wizard.component.ts/html` | Auto-fill, debounce availability, gate actions, hint/error |
| `add-employee-wizard.component.spec.ts` | Suggestion/overwrite/duplicate/payload coverage |

## Tests run

```text
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
  → 38 files, 293 passed

npm run build
  → succeeded (existing CSS budget warnings unrelated)

git diff --check
  → clean (LF warnings only)
```

## Skipped checks

- Full-app e2e / Playwright against a running API.
- Manual cross-browser pass.
- Bulk onboarding CSV employee-number UX (out of scope).

## Remaining risks

1. Frontend “Available” can race with another HR finalize — backend 409 remains the source of truth.
2. Root `AddEmployeeWizardStore` can leave timing-sensitive HTTP from prior tests; specs drain suggestion/availability in `afterEach`.
3. If suggestion API fails, HR must type a number; Continue is blocked until a valid available value exists.
