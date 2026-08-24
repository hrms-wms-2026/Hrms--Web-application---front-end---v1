# General Settings — Default Break Duration (Frontend)

## Summary

Added a "Break duration" field to the Legal Entity General Settings screen
(`modules/organization/feature/general-settings`), placed directly under the existing
"Default work hours" section (Work start time / Work end time), consuming the backend's new
`breakDurationMinutes` field on `LegalEntityGeneralSettings` /
`UpdateLegalEntityGeneralSettingsRequest`. Verified via `git status`, reading the current
component/store/API/model files, and grepping for `workEndTime`/`breakDuration` before starting
— the field did not already exist anywhere in the frontend. Clock-in Policy
(`modules/settings/feature/clock-in-policy-form`) was not touched.

## UI

- Label: **Break duration**
- Input: `type="number"`, `hint="minutes"`, `placeholder="e.g. 60"` (using the shared
  `app-input` component, same as every other field on this form).
- Location: its own row inside the existing "Default work hours" `gs-section-block`, right below
  the work start/end time row and its validation message — same section, not a new one.
- Nothing else on the General Settings layout, the sidebar/topbar, logo upload, country/currency/
  timezone behavior, or Clock-in Policy files was changed.

## Validation

- Blank is allowed → sends `null`.
- Only whole non-negative numbers are accepted: `Validators.pattern(/^\d+$/)` on the
  (string-typed, mirroring `workStartTime`/`workEndTime`'s own convention) form control — this
  single pattern naturally rejects decimals (no `.` in the character class) and negative values
  (no `-` in the character class), while treating a blank string as valid (Angular's `pattern`
  validator, like `Validators.email`/`Validators.pattern` elsewhere in this form, only runs
  against a non-empty value).
- Validation surfaces before Save: the field participates in the reactive form's `invalid` state
  like every other control, so `onSubmit()`'s existing `if (... || this.form.invalid) { ...
  return; }` guard blocks the HTTP call and marks the field touched/errored — no separate
  after-the-fact backend-400 path was added or needed.
- Independent of Work start/end time: it is its own form control with its own pattern validator,
  not part of `workTimePairValidator()`'s group validator, so it can be set, cleared, or invalid
  without affecting or being affected by the work-time pair's own state (and vice versa).

## Payload mapping

- Blank input (`''`) → `breakDurationMinutes: null`.
- Valid numeric string → `breakDurationMinutes: Number(value)` (e.g. `'60'` → `60`).
- On load, an existing numeric value is rendered back into the form as a string
  (`String(settings.breakDurationMinutes)`); `null` renders as `''` — same round-trip pattern the
  file already uses for `workStartTime`/`workEndTime`.

## Files changed

- `src/app/modules/organization/models/legal-entity.model.ts` — `breakDurationMinutes: number | null`
  added to `LegalEntityGeneralSettings` and `UpdateLegalEntityGeneralSettingsRequest`.
- `src/app/modules/organization/feature/general-settings/general-settings.component.ts` — new
  `breakDurationMinutes` form control (with pattern validator); wired into
  `emptyFormValue()`/`toFormValue()`/`toRequestPayload()`.
- `src/app/modules/organization/feature/general-settings/general-settings.component.html` — new
  input row inside the "Default work hours" section.
- Tests (see below) — `general-settings.component.spec.ts`,
  `general-settings.store.spec.ts`, `legal-entity-api.service.spec.ts` updated for the new
  required model field plus new break-duration-specific test cases.

`legal-entity-api.service.ts` itself needed no change — it already forwards the whole typed
payload/response object through `HttpClient`, so the new field flows through automatically once
the model interfaces declared it.

## Tests

New/updated cases in `general-settings.component.spec.ts` (`describe('breakDurationMinutes', ...)`
plus updates to the existing `settingsFor()` fixture and the PUT-body-keys assertion):

- Field renders in the Default work hours section (`app-input[type="number"]` present, "Break
  duration" text present).
- Loads an existing value from the API into the form (`'60'` string) and the form is valid.
- Leaves the field blank when the API returns `null`.
- `toRequestPayload` sends `null` when the field is blank.
- `toRequestPayload` sends a `number` (not a string) for a valid value.
- A negative value (`'-1'`) blocks the form (`form.invalid === true`) and the API is never called
  (`httpMock.expectNone(...)`) — validation-before-Save, not just a 400 handler.
- A decimal value (`'7.5'`) blocks the form the same way.
- `'0'` is accepted as valid (boundary case for the `>= 0` rule).

Existing work-time tests (`workStartTime`/`workEndTime` pair validation, blank→null,
valid→HH:mm, invalid combinations) are unmodified and still pass — `breakDurationMinutes` was
added as an independent control, not folded into `workTimePairValidator()`.

## Verification commands run

```
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts"
  → Test Files 20 passed (20), Tests 252 passed (252)

npm run build
  → Build succeeded. Output location: dist/Customer-web-application
    (Pre-existing warnings only: NG8102 nullish-coalescing hints in unrelated
    modules/work components, and CSS budget warnings on several component
    stylesheets I did not touch, including general-settings.component.css,
    which was already over its 4 kB budget before this change — no CSS file
    was edited as part of this task.)

git diff --check -- src/app/modules/organization
  → No errors (only pre-existing LF→CRLF line-ending warnings on this Windows
    checkout, not real whitespace/conflict-marker issues).
```

## Skipped checks

- No live browser/manual verification of the rendered page was performed in this session (no
  dev server + authenticated tenant session was stood up for a click-through). The component
  spec's rendering assertion (`app-input[type="number"]` present, "Break duration" text present,
  load/save round-trip through mocked `HttpClient`) is the closest substitute available here —
  it verifies DOM output and payload shape but not visual layout/spacing in a real browser. A
  quick manual look at `/settings/general` (or wherever this route is mounted) before merging is
  recommended.
- Backend must be running with the new `breakDurationMinutes` field (see the paired backend
  report) for this to work end-to-end; frontend alone can't be exercised against a live API
  without it.

## Remaining risks

- No upper bound is enforced (matches the backend, which was deliberately given none per the
  task's instruction). A very large number of minutes (e.g. `999999`) is currently accepted by
  both sides.
- The `type="number"` native input still allows a user to type things like `1e5` or use the
  browser's up/down spinners past sensible values in some browsers; the Angular pattern validator
  is the actual gate (native HTML5 number-input quirks are not a new risk introduced by this
  field — `financialYearStartMonth`/`firstDayOfWeek` on this same form are also plain
  `Validators.min/max` on numeric controls without extra native-input hardening).
