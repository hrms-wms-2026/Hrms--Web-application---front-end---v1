# Position Capacity-Driven Type & Code Length Frontend Alignment Report

## Summary
Updated frontend Position create/edit form, validation, request models, API payloads, template preset code generation, and unit tests to align with the backend contract correction where `positionType` is derived by the backend based on `maxOccupancy` (capacity $\ge 1$) and position code is capped at a maximum of 5 characters.

---

## Files Changed

### Models & Services
- `src/app/modules/organization/models/position.model.ts`: Removed `positionType` property from `CreatePositionRequest` and `UpdatePositionRequest` interfaces.
- `src/app/shared/ui/input/input.component.ts`: Added `maxlength = input<number | null>(null)` signal input and bound `[attr.maxlength]` on the underlying HTML `<input>` element for text-like inputs.

### Form Modal Component & Template
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.ts`:
  - Removed `positionType` from `PositionFormSubmitValue`.
  - Removed `positionType` form control and `typeOptions` / `onTypeChange`.
  - Added integer custom validator (`integerValidator`) and `Validators.min(1)` for `maxOccupancy`.
  - Updated `code` control validation to `Validators.maxLength(5)` and pattern `/^[A-Za-z0-9_-]{1,5}$/`.
  - Implemented `generateShortCode(titleOrKey)` helper to convert template titles/keys to short acronym codes ($\le 5$ uppercase chars, splitting on spaces/hyphens/underscores/slashes).
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.html`:
  - Removed Position type dropdown (`app-select[label="Position type *"]`).
  - Rendered `Capacity *` input unconditionally with `hint="Capacity 1 creates a single-seat position. More than 1 creates a pooled position."`.
  - Bound `[maxlength]="5"` on the Position code input.

### Feature Component
- `src/app/modules/organization/feature/position-management/position-management.component.ts`:
  - Removed `positionType` from `createPosition` payload in `onSavePosition`.
  - Removed `positionType` from `updatePosition` payload in `onSavePosition` and `onReparentPosition`.

### Unit Tests
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.spec.ts`:
  - Added unit test verifying Position type dropdown is NOT rendered.
  - Added unit test verifying `Capacity *` input is rendered unconditionally with default `1` and correct helper text.
  - Added unit test verifying capacity validation: rejects 0, negative (-1), and decimals (1.5); accepts positive integers $\ge 1$.
  - Added unit test verifying code max length 5 validation (accepts 5 chars, rejects >5 chars).
  - Added unit test verifying `generateShortCode` returns correct short codes ($\le 5$ chars) for:
    - `Chief Executive Officer` $\rightarrow$ `CEO`
    - `CEO / Chief Executive Officer` $\rightarrow$ `CCEO`
    - `Chief Operating Officer` $\rightarrow$ `COO`
    - `COO / Chief Operating Officer` $\rightarrow$ `CCOO`
    - `Chief Technology Officer` $\rightarrow$ `CTO`
    - `CTO / Chief Technology Officer` $\rightarrow$ `CCTO`
    - `Chief Financial Officer` $\rightarrow$ `CFO`
    - `HR Manager` $\rightarrow$ `HM`
    - `Software Engineer` $\rightarrow$ `SE`
    - `Project Manager` $\rightarrow$ `PM`
    - `Engineering` $\rightarrow$ `ENGIN`
  - Added unit tests confirming emitted `save` payload excludes `positionType`.
- `src/app/modules/organization/data-access/position-api.service.spec.ts`:
  - Updated `createPosition` test payload to exclude `positionType` and assert `positionType` is not sent to HTTP endpoint.
- `src/app/modules/organization/feature/position-management/position-management.component.spec.ts`:
  - Updated create/update test payloads and request expectations to exclude `positionType` and use codes $\le 5$ chars.

---

## Contract Confirmation & Payload Shape

### Request Payload Shape
The frontend now sends strictly the following fields to `POST /org/legal-entities/{id}/positions` and `PUT /org/legal-entities/{id}/positions/{id}`:
```json
{
  "departmentId": "dept-1",
  "name": "Software Engineer",
  "code": "SE",
  "maxOccupancy": 1,
  "reportsToPositionId": null
}
```
`positionType` is **never sent** in create or update requests.

### Response Display
Read-only display badges for `positionType` (`Unique` / `Pooled`) in the Position hierarchy tree nodes (`app-position-tree-node`) and Position list table (`app-position-list-table`) remain intact, displaying the backend-derived `positionType` returned in GET response DTOs (`PositionListItemResponse` / `PositionTreeNodeResponse`).

---

## Automated Verification

1. **Unit Tests**:
   - Command: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts`
   - Result: **194 / 194 passed** across all 19 test files.

2. **Production Build**:
   - Command: `npm run build`
   - Result: **Build succeeded with 0 errors**.

3. **Git Diff Check**:
   - Command: `git diff --check`
   - Result: **Passed with 0 whitespace / formatting errors**.

---

## Skipped Checks
- End-to-end browser runtime tests against a running live backend instance were skipped (backend container environment unattached; verified via frontend unit tests and production build compilation).

## Remaining Risks
- Existing position codes in tenant databases longer than 5 characters will need to be shortened prior to running backend DB migration `20260812102930_AddPositionCodeMaxLength`.
- Backend response `positionType` remains read-only display. If backend returns an unexpected case/string variant, existing fallback defaults (`'unique'`) handle display safely.
