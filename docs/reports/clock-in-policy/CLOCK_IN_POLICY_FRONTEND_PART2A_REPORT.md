# Clock-in Policy Frontend — Part 2A Report

## Summary

Frontend foundation and list-page shell for Clock-in Policy are implemented under Settings. Scope is models, legal-entity-scoped API service methods, signal store, route/nav gating, and the list UI shell only.

**Create/edit form was not implemented** (Part 2B). Late-deduction-rule editing was not implemented. Device/outage/fallback UI was not included or referenced.

No backend changes. No commit/push.

## Pre-change inspection

- `git status --short --branch` on `feature/employee-management-phase1-foundation` showed unrelated prior WIP; Clock-in Policy frontend was absent.
- Architecture: `ONEVO_HRMS_Frontend_Architecture.md` (modular feature / data-access / state / models).
- Patterns followed: Settings routes in `app.routes.ts`, Settings sub-nav in `nav-items.config.ts`, General Settings / Departments list shells, `LegalEntityStore` company context, `permissionGuard` + `PermissionService`, `environment.apiUrl` (no hardcoded localhost), CSRF via existing interceptors.
- Backend contract read from HRMS-Backend-v1 controllers, DTOs, upsert request, and Part 1 report.

## Placement

New Settings domain folder (no existing attendance settings module):

```text
src/app/modules/settings/
  models/clock-in-policy.model.ts
  utils/clock-in-policy-display.utils.ts(+spec)
  data-access/clock-in-policy-api.service.ts(+spec)
  state/clock-in-policy.store.ts(+spec)
  feature/clock-in-policy-list/(component + html + css + spec)
```

## Route path

`/settings/clock-in-policy`

- Lazy-loaded `ClockInPolicyListComponent`
- `permissionGuard` with `permissions: ['attendance:read']`, `modules: ['time_attendance']`

## Settings sub-sidebar

- Label: **Clock-in Policy**
- Path: `/settings/clock-in-policy`
- `requiredModules: ['time_attendance']`
- `requiredPermissions: ['attendance:read']`
- Not shown for Settings-only permissions (e.g. `legal_entity:update` alone)

## API service methods and exact endpoints

Base: `{environment.apiUrl}/attendance/legal-entities/{legalEntityId}/clock-in-policies`  
(`environment.apiUrl` already includes `/api/v1`)

| Method | HTTP | Endpoint |
|:-------|:-----|:---------|
| `list(legalEntityId, includeInactive?)` | GET | `/api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies?includeInactive=` |
| `get(legalEntityId, id)` | GET | `/api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies/{id}` |
| `create(legalEntityId, payload)` | POST | `/api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies` |
| `update(legalEntityId, id, payload)` | PUT | `/api/v1/attendance/legal-entities/{legalEntityId}/clock-in-policies/{id}` |
| `archive(legalEntityId, id)` | POST | `.../{id}/archive` |
| `restore(legalEntityId, id)` | POST | `.../{id}/restore` |

Part 2A UI uses **list** only. Mutation methods exist for service-pattern consistency; no UI flows call them yet. No `tenantId` in body/query.

## Store behavior

`ClockInPolicyStore` (NgRx Signal Store, `providedIn: 'root'`):

- State: `policies`, `loading`, `error`, `includeInactive`, `legalEntityId`, `inFlightKey`, `loadedKey`
- `loadPolicies(legalEntityId, includeInactive?)` — no-op if id empty; dedupes in-flight same key; skips reload when same key already loaded successfully
- `setIncludeInactive(value)` — updates flag and reloads once when a legal entity is known
- `clear()` — resets to initial state
- Load errors always store: `Could not load clock-in policies. Try again.`

## Permission / module gating

| Surface | Gate |
|:--------|:-----|
| Nav item | `time_attendance` **and** `attendance:read` |
| Route | same via `permissionGuard` |
| List view | component checks module + `attendance:read` |
| Create controls | shown only with `attendance:write`; disabled until Part 2B |

Settings parent remains visible from any visible child; Clock-in Policy does not appear from Settings permissions alone.

## UI labels

| Element | Copy |
|:--------|:-----|
| Page title | Clock-in Policy |
| Subtitle | Control how employees can clock in for onsite, remote, hybrid, and field work. |
| No company | Select a company to view clock-in policies. |
| Empty title | No clock-in policies yet |
| Empty body | Create a policy to define how employees can clock in for onsite, remote, hybrid, and field work. |
| Create button | Create policy (disabled; Part 2B) |
| Inactive toggle | Show inactive policies (default off) |
| Scope labels | Company / Departments / Positions / Employees |
| End date null | No end date |
| Late rules | `0 late rules` / `1 late rule` / `{n} late rules` |
| Status | Active / Inactive |

List has no row action menu in Part 2A.

## Hybrid vs Either

- Models and subtitle use **Hybrid** (`workAreaRules.hybrid`, Hybrid wording in copy).
- UI, empty states, errors, tests, and this report do **not** expose `either` / `either_*` as product language.
- Backend persistence mapping (`either_*`) is intentionally not surfaced in the frontend.

## Device / outage / fallback exclusion

Confirmed **not** implemented, linked, or displayed:

- biometric outage fallback
- device outage fallback
- attendance device management
- affected device
- temporary fallback windows
- fallback status/resolution
- read-only fallback note/link

Regression tests assert forbidden words are absent from the list page text.

## Files changed / added

### Added
- `src/app/modules/settings/models/clock-in-policy.model.ts`
- `src/app/modules/settings/utils/clock-in-policy-display.utils.ts`
- `src/app/modules/settings/utils/clock-in-policy-display.utils.spec.ts`
- `src/app/modules/settings/data-access/clock-in-policy-api.service.ts`
- `src/app/modules/settings/data-access/clock-in-policy-api.service.spec.ts`
- `src/app/modules/settings/state/clock-in-policy.store.ts`
- `src/app/modules/settings/state/clock-in-policy.store.spec.ts`
- `src/app/modules/settings/feature/clock-in-policy-list/clock-in-policy-list.component.ts`
- `src/app/modules/settings/feature/clock-in-policy-list/clock-in-policy-list.component.html`
- `src/app/modules/settings/feature/clock-in-policy-list/clock-in-policy-list.component.css`
- `src/app/modules/settings/feature/clock-in-policy-list/clock-in-policy-list.component.spec.ts`
- `CLOCK_IN_POLICY_FRONTEND_PART2A_REPORT.md` (this file)

### Updated
- `src/app/app.routes.ts` — Settings child route
- `src/app/layouts/main-layout/nav/nav-items.config.ts` — nav item
- `src/app/layouts/main-layout/nav/nav-access.spec.ts` — gating tests

## Tests run

| Check | Result |
|:------|:-------|
| `npx ng test --no-watch --include src/app/modules/settings/**/*.spec.ts --include src/app/layouts/main-layout/nav/nav-access.spec.ts` | **43 passed** |
| `npm run build` | Passed (pre-existing style-budget / CommonJS warnings unrelated) |
| `git diff --check` (Part 2A paths) | Clean |

## Skipped checks and why

1. **E2E / Playwright** against a live backend — out of Part 2A scope; Docker/backend HTTP not required for this shell.
2. **Create/edit form tests** — Part 2B.
3. **Archive/restore/update UI flows** — service methods only; no UI yet.

## Remaining risks

1. Create button is intentionally **disabled** until Part 2B wires a create route/form.
2. Store skips redundant loads for the same `legalEntityId|includeInactive` after success; explicit force-refresh is not exposed (retry after error still works because `loadedKey` is cleared on failure).
3. Date display uses `yyyy-MM-dd` from API DateOnly strings; locale formatting can be refined later if General Settings date format should apply.
4. `time_off_types` still missing on backend for late-rule labels in a future form (Part 2B concern).

## Explicit Part 2B note

**Create/edit form, late-deduction-rule editing UI, and mutation UX (archive/restore) were not implemented in Part 2A.** Detail/upsert TypeScript models and API mutation methods are present only for future form compatibility.
