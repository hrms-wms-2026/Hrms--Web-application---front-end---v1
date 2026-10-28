# Create Company Frontend Implementation Report

## Files changed

- **Modified:** `src/app/modules/organization/models/legal-entity.model.ts` — added `CreateLegalEntityRequest`.
- **Modified:** `src/app/modules/organization/data-access/legal-entity-api.service.ts` + `.spec.ts` — added `createLegalEntity()` and its test.
- **Modified:** `src/app/modules/organization/state/legal-entity.store.ts` + `.spec.ts` — added `saving`/`createError` state, `createCompany()` method, shared `extractErrorMessage` helper, and 3 new tests.
- **Created:** `src/app/modules/organization/ui/create-company-modal/create-company-modal.component.ts` + `.spec.ts` — the new modal, 10 tests.
- **Modified:** `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.ts`, `.html`, `.spec.ts` — replaced the stub `onAddCompany()` with the real flow; 1 existing test replaced (it asserted the old stub notification), 2 new tests added.

## Endpoint used

`POST ${environment.apiUrl}/org/legal-entities`. Request body keys, in order: `name, companyCode, registrationNumber, countryCode, currencyCode, taxRegistrationNumber, parentLegalEntityId` — verified exactly by `legal-entity-api.service.spec.ts`'s `Object.keys(req.request.body)` assertion. No `tenantId` or other internal field is ever sent. The response is consumed as the direct `LegalEntityGeneralSettings` JSON — no `{data, success, message}` wrapper, matching how every other endpoint on this service already behaves (and contradicting the architecture doc's generic wrapper example, which is stale for this module).

## Permissions used

- `legal_entity:create` gates the "Add Company" menu item's visibility (`canCreateLegalEntity`, pre-existing) and is therefore also what gates the modal's reachability — the modal is only ever instantiated (`@if (showCreateModal())`) after that gated menu item is clicked, so there is no separate re-check needed inside the store or modal.
- `org:read`/`org:manage` (`hasOrgAccess`, unchanged) continues to gate the company list load that powers the selector and the modal's parent-company dropdown.
- General Settings route permission (`legal_entity:update`) was not touched by this work.
- No `legal_entity:read` permission was introduced anywhere — confirmed by review of every file changed.

## Access-filter / UX behavior

- **Success:** the store's `createCompany()` posts, then calls the existing `loadCompanies()` to refresh — this is a full re-fetch, not a manual list patch, so the new company appears via the same server-authoritative path as any other load. `loadCompanies()`'s existing localStorage round-trip (`legal-entity.store.ts` lines ~46-60) means the previously selected company stays selected as long as it's still present in the refreshed list — verified by the company-selector test that explicitly selects `comp-2` before creating, then asserts `selectedLegalEntityId()` is still `comp-2` after the refresh. The modal closes and a success notification (`Company '<name>' created successfully.`) is shown.
- **Failure:** the modal stays open, `store.createError()` is populated via the same `extractErrorMessage` shape `DepartmentStore` uses (pulls `detail`/`message`/`title`/first `errors[key]` off the HTTP error body), and an error notification is shown with that message. Verified for a 409 conflict response.
- **Duplicate-submit / stale-response protection:** `createCompany()` early-returns `false` without issuing a second HTTP request if `store.saving()` is already `true`; the modal's submit button is also `[disabled]="saving"` with a loading spinner. Both are covered by dedicated tests (store-level "ignores a second createCompany call while one is already saving"; component-level "disables the submit button... while saving" and "ignores submit while saving even if invoked directly").

## Creator membership

The frontend makes **no claim** about creator membership. After a successful create, the UI shows exactly what the refreshed company list from `GET /api/v1/org/legal-entities` actually returns — nothing more. If the backend does not grant the creator any special access to the new company (see the backend report: creator membership is **not implemented**, blocked by a global unique `UserId` index on `Employee`), the new company will simply appear in the list the creator's *existing* permissions already entitled them to see (e.g. full-tenant visibility for `legal_entity:update`/`legal_entity:delete` holders), not because of any new membership. No success message, modal copy, or code path in this implementation implies the creator gained a new employee/company assignment. Manual verification against a live backend was not performed in this session (no running dev environment was available) — only automated tests against the described contract.

## Tests / build commands run

All run from `C:\onevoNew\Hrms--Web-application---front-end---v1`, branch `feature/sidebar-legalentity`:

| Command | Result |
|---|---|
| `npm test -- --include "src/app/modules/organization/data-access/legal-entity-api.service.spec.ts" --watch false` | **8/8 passed** |
| `npm test -- --include "src/app/modules/organization/state/legal-entity.store.spec.ts" --watch false` | **9/9 passed** |
| `npm test -- --include "src/app/modules/organization/ui/create-company-modal/create-company-modal.component.spec.ts" --watch false` | **10/10 passed** |
| `npm test -- --include "src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.spec.ts" --watch false` | **11/11 passed** |
| `npm test -- --include "src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts" --watch false` | **16/16 passed** (pre-existing, unaffected) |
| `npm run build` | Succeeded — only pre-existing CSS-budget and `i18n-iso-countries` CommonJS warnings, unrelated to this work |
| `git diff --check` | Clean, no whitespace errors |

**Note on the plan's assumed CLI flag:** the plan's draft command `npm test -- --run <path>` does not exist on this Angular/Vitest builder (`Error: Unknown argument: run`). The correct flag, discovered via `ng test --help`, is `--include "<glob>" --watch false`. All commands above use the corrected form.

**Two real bugs found and fixed during test-writing** (not present in the final committed code, but worth recording since they'd trip up the next person copying this pattern):
1. In store/component tests, `httpMock.expectOne((r) => predicate)` receives the raw `HttpRequest`, whose `.url` **excludes** query parameters (only `.urlWithParams` includes them). A predicate checking `r.url === '...?includeInactive=false'` never matches. Fixed by using the string-argument form of `expectOne(url)` (which matches `urlWithParams`) for the refresh-list GET, matching the file's own pre-existing convention.
2. Because `createCompany()` chains two awaited HTTP calls (`POST` then `loadCompanies()`'s internal `GET`), the second request does not exist yet in the synchronous line immediately after flushing the first — it needs a microtask tick to fire. Fixed with `await vi.waitFor(() => httpMock.expectOne(...))` around the second request lookup in all three affected tests (store: 2 tests; company-selector: 1 test).

## Skipped checks

- No live backend/dev environment was available in this session to manually exercise the flow in a browser, so only automated Vitest coverage and the production build were used to verify correctness (per the task's own allowance: "if you can't test the UI, say so explicitly rather than claiming success").
- `npm run e2e` (Playwright) was not run — out of scope per the plan, which only required focused unit/component tests plus the production build.

## Remaining risks

- No explicit spec instruction covers parent-company self-exclusion (irrelevant here since create has no existing id to exclude, unlike the department edit-modal pattern it's structurally closest to) — noted as a non-issue, not a gap.
- The `i18n-iso-countries` CommonJS warning and CSS budget warnings are pre-existing repo-wide conditions, unrelated to and not worsened by this change.
- This work was not manually verified against a running backend; the backend report should be read alongside this one before considering the end-to-end flow production-ready.

## Repo state

Branch `feature/sidebar-legalentity`, 5 local commits, not pushed:

```
085827f feat: wire real Create Company flow into the company selector
23e78a3 feat: add CreateCompanyModalComponent
c4b84fd feat: add LegalEntityStore.createCompany
e89ae46 feat: add LegalEntityApiService.createLegalEntity
1c8bd96 feat: add CreateLegalEntityRequest model
```

`git diff --check` is clean. This report file itself is uncommitted, per the task's "do not commit or push" instruction — left for the user to review and decide on committing.
