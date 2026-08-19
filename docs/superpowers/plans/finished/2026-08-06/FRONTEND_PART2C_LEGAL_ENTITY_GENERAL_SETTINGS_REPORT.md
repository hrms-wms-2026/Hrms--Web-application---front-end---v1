# Frontend Part 2C — Legal Entity / Company General Settings Page — Report

> Scope: General Settings page only. No backend, OneVo-HR doc, or Postman files touched. No commit/push performed (per task instructions) — all changes are in the working tree.

---

## 1. Files changed

**Created:**
- `src/app/modules/organization/state/general-settings.store.ts` — detail/form-load state, separate from `LegalEntityStore`.
- `src/app/modules/organization/state/general-settings.store.spec.ts`
- `src/app/modules/organization/utils/general-settings-options.ts` — weekday/month/time-format/status/date-format select options.
- `src/app/modules/organization/utils/general-settings-validators.ts` — `nonEmptyArrayValidator`, `absoluteUrlValidator`, `oneOfValidator`.
- `src/app/modules/organization/utils/general-settings-validators.spec.ts`
- `src/app/modules/organization/feature/general-settings/general-settings.component.ts`
- `src/app/modules/organization/feature/general-settings/general-settings.component.html`
- `src/app/modules/organization/feature/general-settings/general-settings.component.css`
- `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts`
- `src/app/app.routes.spec.ts` — no such file existed before this task.
- `docs/superpowers/plans/2026-08-06-legal-entity-general-settings.md` — implementation plan used to build this feature.
- This report.

**Modified:**
- `src/app/modules/organization/models/legal-entity.model.ts` — added `LegalEntityAddress`, `LegalEntityGeneralSettings`, `UpdateLegalEntityGeneralSettingsRequest` interfaces (existing `LegalEntityListItem` untouched).
- `src/app/modules/organization/data-access/legal-entity-api.service.ts` — added `getGeneralSettings()`, `updateGeneralSettings()`.
- `src/app/modules/organization/data-access/legal-entity-api.service.spec.ts` — added tests for both new methods.
- `src/app/modules/organization/state/legal-entity.store.ts` — added `updateCompanyDisplay()` method (patches a company's `name`/`companyCode`/`isActive` in the selector list after a successful save).
- `src/app/modules/organization/state/legal-entity.store.spec.ts` — added a test for `updateCompanyDisplay`.
- `src/app/app.routes.ts` — the `settings/general` child's `loadComponent` now points at `GeneralSettingsComponent` instead of the generic `PlaceholderPageComponent`. `canActivate: [permissionGuard]` and `data: { permissions: ['org:manage'] }` were already present from Part 2A/2B and were left unchanged.

**Untouched (confirmed by scope):** all backend files, `HRMS-Backend-v1/**`, `OneVo-HR` docs, Postman files, Department/Position feature files, auth/session code, `NAV_ITEMS`/`nav-access.ts`/`sub-sidebar.component.*`, logo upload, country/currency lookups.

---

## 2. Routes

- `/settings` → redirects to `/settings/general` (this redirect already existed from Part 2A/2B; this task did not add it, only verified it via `app.routes.spec.ts`).
- `/settings/general` → now resolves to `GeneralSettingsComponent` (previously a generic placeholder). Guarded by the existing `permissionGuard` with `data: { permissions: ['org:manage'] }`.
- Sidebar: `NAV_ITEMS` already had a `settings-general` entry (`/settings/general`, `requiredPermissions: ['org:manage']`) from prior parts — not modified.

---

## 3. API endpoints used

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/org/legal-entities/{id}/general-settings` | `org:manage` | Loads the form on mount and on company switch. |
| PUT | `/api/v1/org/legal-entities/{id}/general-settings` | `org:manage` | Save. `{id}` is the route-scoped selected company id — never sent in the body. |

### Exact response fields consumed (`LegalEntityGeneralSettingsResponse`, camelCase on the wire)
`id, name, companyCode, logoFileId, registrationNumber, taxRegistrationNumber, vatGstNumber, email, phoneNumber, website, countryCode, currencyCode, timezone, financialYearStartMonth, firstDayOfWeek, standardWorkingDays, defaultLanguage, dateFormat, timeFormat, status, registeredBusinessAddress { line1, line2, city, state, postalCode, country }`

### Exact request fields sent (`UpdateLegalEntityGeneralSettingsRequest`)
`name, companyCode, registrationNumber, taxRegistrationNumber, vatGstNumber, email, phoneNumber, website, countryCode, currencyCode, timezone, financialYearStartMonth, firstDayOfWeek, standardWorkingDays, defaultLanguage, dateFormat, timeFormat, status, registeredBusinessAddress`

Confirmed by test (`general-settings.component.spec.ts`, "save() PUTs..."): the request body's key set is asserted exactly against this list — no `id`, `tenantId`, `parentLegalEntityId`, or `logoFileId` is present.

---

## 4. Permission behavior

- **Route level (primary gate):** `permissionGuard` on `/settings/general` requires `org:manage`; a user without it is redirected to `/dashboard` before the component ever mounts. This was already in place from Part 2A/2B and was not changed.
- **Component level (defense-in-depth):** `GeneralSettingsComponent.hasAccess` computes `permissionService.hasPermission('org:manage')`. When false, the component renders an empty/unavailable state ("You don't have access to this.") and its selection-change effect returns early without calling the API — verified by a test asserting zero HTTP requests fire.
- Save is only reachable through the same gated form; there is no separate save-permission check because the same `org:manage` requirement covers both GET and PUT per the backend (`LegalEntitiesController.cs:39-48`/`72-107`).

---

## 5. Validation behavior

All rules mirror `UpdateLegalEntityGeneralSettingsCommandValidator.cs` exactly:

| Field | Rule |
|---|---|
| name | required, max 200 |
| companyCode | required, max 20 |
| registrationNumber | required, max 50 |
| taxRegistrationNumber | max 80 (optional) |
| vatGstNumber | max 50 (optional) |
| email | valid email, max 254 (optional — blank sent as `null`) |
| phoneNumber | max 20 (optional) |
| website | max 255, must be an absolute URI when present (custom `absoluteUrlValidator`, mirrors `Uri.TryCreate(..., UriKind.Absolute, ...)`) |
| countryCode | required, max 3 (free text — no ISO allow-list, matching backend) |
| currencyCode | required, max 3 (free text — no ISO allow-list, matching backend) |
| timezone | required, max 50 |
| financialYearStartMonth | required, 1–12 |
| firstDayOfWeek | required, 1–7 |
| standardWorkingDays | non-empty (`nonEmptyArrayValidator`), values constrained to 1–7 by the checkbox UI itself |
| defaultLanguage | required, max 10 |
| dateFormat | required, max 20 (curated dropdown for UX; backend has no enum, so any ≤20-char value is valid) |
| timeFormat | required, must be `'12h'`/`'24h'` (`oneOfValidator`) |
| status | required, must be `'active'`/`'inactive'` (`oneOfValidator`) |
| registeredBusinessAddress.* | each sub-field optional with its own max length (255/255/100/100/20/100); the whole object is sent as `null` if every sub-field is blank |

**Assumption called out explicitly:** `firstDayOfWeek`/`standardWorkingDays` use ISO-8601 weekday numbering (Monday=1…Sunday=7). The backend validator only constrains the range (1–7); it does not document which integer maps to which day. This is a frontend assumption, not a confirmed backend fact.

Tests cover: blocked submit on empty name, out-of-range `financialYearStartMonth`, empty `standardWorkingDays`, invalid email, schemeless website URL — each via direct `FormGroup` assertions plus dedicated unit tests for the three custom validators.

---

## 6. State design

- `LegalEntityStore` (existing, from Part 2B) — company list + `selectedLegalEntityId`, unchanged except for the new `updateCompanyDisplay()` method.
- `GeneralSettingsStore` (new) — holds `legalEntityId`, `settings`, `loading`, `saving`, `loadError`, `saveError` for exactly one company at a time. Kept deliberately separate from `LegalEntityStore` per the task's "keep selected legal entity state separate from form state" requirement.
- **No cross-company leak:** `GeneralSettingsComponent` has an `effect()` that resets the Reactive Form to empty values *before* calling `settingsStore.load()` on every `selectedLegalEntity()` change, and `GeneralSettingsStore.load()` resets its own state (`{...initialState, legalEntityId, loading: true}`) before issuing the GET. A second guard compares `store.legalEntityId()` against the request's target id before applying a response, so a stale in-flight request for a previously-selected company can never overwrite a newer selection. Both behaviors are covered by dedicated store and component tests.
- **Save flow:** shows `saving` via a `submitting` signal (disables the Save button and prevents duplicate submission), and on success calls `LegalEntityStore.updateCompanyDisplay()` so the topbar company selector immediately reflects a changed name/code/status without a full list re-fetch. On failure, `saveError` is rendered and the form values are left exactly as typed (no reset).

---

## 7. Out-of-scope items (per task instructions — not built)

- Create Company modal
- Delete Company modal
- Logo upload/change — the backend's `PUT .../logo` endpoint is deliberately not exposed (`LegalEntitiesController.cs:15-18`); the page renders a disabled "Change logo" placeholder button with a hint that upload isn't available yet. `DELETE .../logo` (remove) is a live, wired endpoint, but was intentionally not called from this page — logo removal without any upload path isn't independently useful, so the whole logo feature is treated as backend-incomplete and out of scope for Part 2C.
- `country_id`/`countries` lookup — Country and Currency are plain text inputs (no lookup table exists backend-side).
- Departments and Positions UI.
- Policy Configuration, Devices & Connections, Audit Log — rendered as **inert, non-routed placeholder rows** inside the General Settings page body (not as gated `NAV_ITEMS`/sidebar entries). This is a deliberate deviation from a literal reading of "sub-sidebar": `nav-access.ts`'s `canAccessNavItem` makes the Settings rail item visible purely from child visibility (no permission gate of its own). Adding any of these three as an ungated `NAV_ITEMS` child would have made the whole Settings section visible to users with zero settings permissions — an explicit nav-gating regression the task forbids ("Do not loosen frontend route/nav gating"). No backend permission string exists yet for any of the three, so they cannot be safely gated. `NAV_ITEMS`, `nav-access.ts`, and `sub-sidebar.component.*` were not modified.

---

## 8. Tests run

`npx ng test --watch=false` (full suite). Note: the task's listed command `npm test -- --watch=false` was tried first and fails in this repo with `Error: Unknown argument: watch` — the `npm test` script (`ng test`) does not forward `--watch=false` correctly through `npm run -- ...` in this Angular/Vitest CLI version. `npx ng test --watch=false` (invoking the Angular CLI directly) is the working equivalent and was used for all test runs in this task:

```
Test Files  53 passed (53)
     Tests  244 passed (244)
```

This includes all new/modified spec files for this task:
- `legal-entity-api.service.spec.ts` (6 tests, incl. 2 new)
- `legal-entity.store.spec.ts` (6 tests, incl. 1 new)
- `general-settings.store.spec.ts` (7 tests, new file)
- `general-settings-validators.spec.ts` (8 tests, new file)
- `general-settings.component.spec.ts` (13 tests, new file) — covers: loads selected company; reloads (no leaked values) on company switch; save PUTs to the route-scoped id with the exact expected body key set; validation blocks (required fields, month range, empty working days, invalid email, schemeless URL, and a backend-returned `null` for `registrationNumber`/`companyCode`/`timezone` — nullable on GET but required on PUT); permission-denied state blocks render/API calls; API error shows failure state and keeps typed values; success updates the displayed company name in `LegalEntityStore`.
- `app.routes.spec.ts` (2 tests, new file) — `/settings` → `/settings/general` redirect, and `/settings/general` resolving successfully.

No `theme uses CSS variables not hardcoded colors` automated test was added — this was verified by inspection instead (see §9), consistent with how the existing `shared/ui` components' token usage is not separately unit-tested in this repo either.

---

## 9. Theme/design verification

`general-settings.component.css` uses only existing design tokens from `src/app/shared/styles/theme-tokens.css`: `--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-surface-secondary`, `--color-danger-text`, `--radius-content`. No hex/rgb literals or Tailwind slate/gray utility classes were introduced. All form fields reuse the existing `app-input`/`app-select`/`app-button` components, which already consume the same token set.

---

## 10. Build verification

`npm run build`:
```
Application bundle generation complete. [3.624 seconds]
```
Lazy chunk `general-settings-component` (27.04 kB raw / 5.91 kB transfer) confirms the route lazy-loads correctly and is not bundled into the initial chunk.

`npm run build:staging`:
```
Application bundle generation complete. [5.544 seconds]
```
Same lazy-loading behavior confirmed under the staging configuration.

`git diff --check`: exit code 0, no whitespace errors introduced by this task (the CRLF-conversion notices printed are Git informational warnings about pre-existing Part 2A/2B files this task did not touch, not errors).

**No lint script or ESLint config exists in this repo** (confirmed via `package.json` — no `lint` script, and no `.eslintrc*` file anywhere in the repo root). Lint was not run because there is nothing to run.

---

## 11. Manual verification

**Not run.** No live backend/frontend dev session was available in this task (no confirmation that `HRMS-Backend-v1` was running against an Acme tenant, and the task environment does not have a browser session pre-authenticated as an Acme owner). The 7-step manual verification checklist from the task (login → Settings visible → General Settings loads → company switch reloads → save a harmless field → refresh → persisted value → no console errors) was not performed and no result is claimed for it.

---

## 12. Known assumptions / judgment calls made

1. **ISO-8601 weekday numbering** for `firstDayOfWeek`/`standardWorkingDays` (Monday=1…Sunday=7) — the backend only validates the numeric range, not which day each integer represents.
2. **Country/Currency as free-text inputs**, not dropdowns — no backend lookup table or allow-list exists for either field.
3. **`registeredBusinessAddress` sent as `null` (not an object with all-blank fields)** when every address sub-field is empty, to avoid sending an unnecessary empty object; this is not explicitly specified by the backend but is a reasonable interpretation of the field being optional (`LegalEntityAddressDto?`).
4. **Policy Configuration / Devices & Connections / Audit Log rendered as inert page-body placeholders instead of sidebar nav entries** — see §7 for the full rationale (preserving existing nav-gating invariants over a literal reading of "sub-sidebar").
