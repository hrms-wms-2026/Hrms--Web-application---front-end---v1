# Frontend Part 2B Correction Report — Organization Shell, Sub-Sidebar, Company Selector

> **Scope:** Correction to Part 2B (frontend only).
> **Repository:** `C:\onevoNew\Hrms--Web-application---front-end---v1`
> **Branch:** `Development` (uncommitted)
> **Date:** 2026-08-05

---

## 1. Root Cause

**The Part 2B frontend code was already correct.** Every piece the original report claimed — `NAV_ITEMS` gating, `PermissionService`, `auth.mapper.ts`, the Organization routes, the sub-sidebar, the `LegalEntityStore`, the `CompanySelectorComponent` — was reviewed line-by-line and reproduced live against the running dev stack (backend on `https://acme.localhost:7229`, frontend on `https://acme.localhost:4200`, both already running locally). All of it works exactly as designed.

**The reason Organization was invisible after login is backend seed data on the dev tenant used for manual testing, not a frontend bug.**

Logged in live as the `acme` tenant owner (`siyasiyamala932@gmail.com`, seeded by `DevSmokeTestTenantSeeder`) and called `GET /api/v1/auth/me` directly. The real response:

```json
{
  "authenticated": true,
  "permissions": ["billing:manage", "billing:read", "...", "roles:manage", "roles:read", "settings:notifications", "..." /* no org:read, no org:manage anywhere */],
  "active_modules": ["integrations", "work_management"],
  "workspace": { "slug": "acme", "display_name": "Acme Test" }
}
```

`active_modules` for this tenant contains only `integrations` and `work_management` — none of the canonical Phase 1 module keys (`org_structure`, `core_hr`, `calendar`, `leave`, `time_attendance`, `worksync_foundation`) that `NAV_ITEMS` (correctly) gates on. `permissions` correspondingly has no `org:*` entries at all, because `DefaultRoleSeeder` derives the Owner role's permission grants from the tenant's own module list — a stale module list produces a stale permission set too. Both gates fail from the same single cause.

Traced to source (read-only, backend not modified):

- `src/ONEVO.Infrastructure/Persistence/Seeders/DevSmokeTestTenantSeeder.cs:730` and `:742` **hardcode** `SelectedModulesJson = """["integrations","work_management"]"""` for the `acme`/`dapi` smoke tenants. Line 742 unconditionally overwrites the existing `TenantSubscription` row's `SelectedModulesJson` back to this same hardcoded value **on every backend startup** (it's an idempotent upsert, not a one-time seed) — so even a manual SQL fix on the local dev DB will not survive the next `dotnet run`.
- This is unrelated to the canonical Phase 1 module list. The Starter plan (`subscription_plans.included_modules_json`, migration `20260804024502_UpdateStarterPlanToCanonicalPhase1Modules.cs` and `SubscriptionPlanConfiguration.cs`) does correctly include `org_structure` and all the other keys `NAV_ITEMS` expects — but `GetActiveModuleKeysForTenantAsync` reads from `TenantSubscriptions.SelectedModulesJson`, which is only copied from the plan at tenant *creation* (`CreateTenantCommandHandler.cs:160`). The `acme`/`dapi` smoke tenants never go through that path — they're seeded directly with the old hardcoded list above.
- `PermissionSeeder.cs` and `DefaultRoleSeeder.cs` are correct: `org:read`/`org:manage` are properly mapped to `org_structure` and would be granted to Owner automatically if the tenant's module list included it.

**Conclusion:** the frontend correctly renders whatever the backend says the tenant is entitled to. For the specific dev tenant used to manually validate Part 2B, the backend says "no org access," so Organization is correctly hidden. This is a backend seed-data gap, out of this task's frontend-only scope, and `DevSmokeTestTenantSeeder.cs` was **not modified**, per the "do not touch backend" constraint.

An `auth.mapper.spec.ts` test already existed encoding this exact real payload (`active_modules: ['integrations', 'work_management']`) — whoever wrote Part 2B had already captured and unit-tested against the real response shape; the mapper was never the problem.

---

## 2. Real Bugs Found and Fixed (frontend, in scope)

Independent of the seed-data issue, code review surfaced two genuine frontend gaps against the correction requirements:

### A. Company selector had no error state (Requirement D, Test 9)
`company-selector.component.html` branched only on `loading` → `companies().length === 0` → loaded-with-companies. `store.error()` was never read. On an API failure the panel silently said "No companies found" and the trigger said "Select Company" — indistinguishable from a genuinely empty company list, and not the "Company unavailable" behavior required.

**Fix:**
- `company-selector.component.ts`: added a `triggerLabel` computed signal that resolves, in priority order: selected company name → "Loading companies..." → "Company unavailable" (on `store.error()`) → "No companies" (loaded + empty) → "Select Company".
- `company-selector.component.html`: added an `@else if (store.error())` branch in the dropdown panel rendering `store.error()`'s message with a `company-selector__status--error` class.
- `company-selector.component.css`: added `.company-selector__status--error { color: var(--color-danger-text); }`, reusing the existing design-token convention from `error-state.component.ts`.

### B. `/organization` route guard didn't check the `org_structure` module
`app.routes.ts` gated `/organization` on `permissionGuard` with only `data: { permissions: ['org:read', 'org:manage'] }` — no module check. Nav visibility (`canAccessNavItem`) requires **both** `org_structure` active **and** an org permission, but the route itself was reachable by direct URL with the permission alone, even if `org_structure` were somehow inactive. This let nav visibility and route access diverge.

**Fix:**
- `permission.guard.ts`: `permissionGuard` now also reads `route.data['modules']` and calls `permissionService.hasAnyModule(...)`, any-of, exactly mirroring `canAccessNavItem`'s module+permission AND logic. Route succeeds only when both checks pass.
- `app.routes.ts`: `/organization` route data now includes `modules: ['org_structure']` alongside the existing `permissions`.

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.ts` | Added `triggerLabel` computed signal covering loading/error/empty/selected/default states |
| `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.html` | Use `triggerLabel()`; added error branch to dropdown panel |
| `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.css` | Added `.company-selector__status--error` |
| `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.spec.ts` | Added loading-state, empty-state, error-state tests |
| `src/app/core/guards/permission.guard.ts` | Added `route.data['modules']` any-of check alongside existing permission check |
| `src/app/core/guards/permission.guard.spec.ts` | Added module-gating pass/redirect tests |
| `src/app/app.routes.ts` | Added `modules: ['org_structure']` to `/organization` route data |
| `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts` | Added "hides Organization when module missing but permission present" test and an 8-item canonical-order test |
| `src/app/modules/organization/organization.routes.spec.ts` | Added a second describe block mounting `ORGANIZATION_ROUTES` under a `'organization'` parent path (matching `app.routes.ts`'s actual composition), asserting `/organization` → `/organization/departments` |
| `src/app/modules/organization/feature/departments-placeholder/departments-placeholder.component.spec.ts` | **New** — asserts Requirement G: title is exactly "Departments", body text explains management ships in a later phase |
| `src/app/modules/organization/feature/positions-placeholder/positions-placeholder.component.spec.ts` | **New** — same assertion for "Positions" |

No other files were touched. Everything else in `git status` (Part 2A/theme/shared-UI work) predates this session and was left untouched.

---

## 4. Before / After Visible Behavior

**Before (and after — unchanged, by design):** Logged in live as `siyasiyamala932@gmail.com` on `acme.localhost:4200`. Sidebar shows **Home** and **Settings** only. `/organization` redirects to `/dashboard`. No company selector renders in the topbar (correctly — `hasOrgAccess()` is false for this tenant).

This is **not** a regression and **not** what Requirement A asks to fix — it's the correct rendering of the real (stale) backend data for this specific dev tenant. Settings is visible because the owner does hold `roles:manage` and `notifications:manage`/`settings:notifications`, which are unrelated to `org_structure`.

**Verified via unit test** (not reachable live without backend data changes, which are out of scope): given a user with `active_modules = ['worksync_foundation','core_hr','calendar','leave','time_attendance','org_structure']` and `permissions = ['org:read','roles:manage']`, the side-navbar now renders, in order: `Home, Work, People, Calendar, Time Off, Time & Attendance, Organization, Settings` — all 8 items, matching Requirement A exactly.

**Company selector states**, verified live (error/empty) and via unit test:
- Loading: trigger shows "Loading companies..."
- Loaded with companies: trigger shows selected company name
- Loaded empty: trigger shows "No companies"; panel shows "No companies found"
- Error: trigger shows "Company unavailable"; panel shows the backend error detail in danger-colored text

---

## 5. Auth Response Shape (confirmed against live backend)

Flat JSON, snake_case via explicit `[JsonPropertyName]` attributes on `AuthSessionResponseDto` (`src/ONEVO.Application/Features/Auth/Login/DTOs/Responses/AuthSessionResponseDto.cs`), identical for `POST /auth/login`, `POST /auth/session-exchange`, and `GET /auth/me`. No envelope. Confirmed fields: `authenticated`, `user.email`, `permissions` (top-level array), `active_modules` (top-level array), `workspace.slug`/`workspace.display_name`, `legal_acceptance_required`, `pending_legal_documents`, `redirect_required`, `continue_url`. `auth.mapper.ts`'s `toCurrentUserViewModel` already maps this correctly (`dto.permissions` → `permissions`, `dto.active_modules` → `activeModules`) — no change needed.

---

## 6. Permission/Module Mapping

Confirmed correct, no change needed:
- `PermissionService.hasModule`/`hasAnyModule` read `AuthStore.activeModules()`.
- `PermissionService.hasPermission`/`hasAnyPermission` read `AuthStore.permissions()`, with `'*'` wildcard support for platform superusers.
- `canAccessNavItem` requires module gate AND permission gate for a leaf item; a parent (Organization, Settings) additionally requires at least one reachable child.
- `nav-items.config.ts`'s module keys (`org_structure`, `core_hr`, `calendar`, `leave`, `time_attendance`, `worksync_foundation`) match the backend's canonical Starter-plan module list exactly (confirmed against `UpdateStarterPlanToCanonicalPhase1Modules.cs` and `SubscriptionPlanConfiguration.cs`). **These were not changed** — changing them to match the acme tenant's stale `["integrations","work_management"]` would have been the wrong fix and would silently paper over the real seed-data bug.

Only gap closed: `permissionGuard` now also enforces the module gate (see §2B), keeping route access and nav visibility from being able to diverge.

---

## 7. Tests Added/Updated

| # | Requirement | Status |
|---|---|---|
| 1 | Permission helper reads actual auth response shape | Already covered (`auth.mapper.spec.ts`, using the real captured payload) |
| 2 | Organization nav visible with org:read/manage + org_structure | Already covered + added canonical 8-item full-order test (`side-navbar.component.spec.ts`) |
| 3 | Organization nav hidden when org_structure missing | Already covered + added "permission present, module missing" case |
| 4 | `/organization` redirects to `/organization/departments` | Partially covered before this correction (only the child-relative `/` → `/departments` redirect was asserted); **added** a test mounting the routes under an `'organization'` parent path, matching `app.routes.ts`'s real composition, asserting the full `/organization` → `/organization/departments` path |
| 5 | Sub-sidebar renders Departments/Positions | Already covered (`side-navbar.component.spec.ts`) |
| 6 | Topbar company selector appears for org users | Already covered (`company-selector.component.spec.ts`) |
| 7 | Company selector loading state | **Added** |
| 8 | Company selector shows selected company after load | Already covered |
| 9 | Company selector empty/error state instead of disappearing | **Added** (both empty and error) |
| 10 | Persisted `selectedLegalEntityId` fallback | Already covered (`legal-entity.store.spec.ts`) |

Plus: `permission.guard.spec.ts` gained two tests for the new module-gating branch.

**Requirement G verified directly** (read both placeholder component source files, which had zero existing test coverage): `departments-placeholder.component.ts` renders `<app-page-header title="Departments" .../>` and an `<app-empty-state>` whose description reads "Department hierarchy and management features will be connected in subsequent implementation phases" — no data table, no API calls. `positions-placeholder.component.ts` is the same pattern with "Positions"/"Position management and occupancy features...". Both already satisfied Requirement G; new specs now assert the exact title and body text so a future regression would fail a test instead of going unnoticed.

---

## 8. Verification Results

- `npm test -- --watch=false` → **211 passed, 0 failed** (49 test files) — up from 201 at the start of this correction.
- `npm run build` → **PASSED**, bundle generation complete.
- `npm run build:staging` → **PASSED**, bundle generation complete.
- `git diff --check` → **exit 0**, no whitespace errors. `git diff --check` alone only inspects already-tracked modified files; since most files this correction touched are new/untracked, each was additionally re-checked via `git add -N <path>` (index-only, intent-to-add) followed by `git diff --check` and `git reset` to restore the index — still exit 0, only the same pre-existing benign LF/CRLF autocrlf warnings, no real whitespace errors, across the full changeset.

### Manual verification performed

Both dev servers were already running locally (`ng serve` on `4200`, backend on `7229`) with a valid session. Used browser automation (Playwright) to:
1. Log in as `siyasiyamala932@gmail.com` / re-use existing session on `acme.localhost:4200`.
2. Call `GET /api/v1/auth/me` directly and capture the exact live response (§1).
3. Confirm the sidebar renders exactly `Home, Settings` for this tenant — matching the gating logic given this tenant's actual entitlements.
4. Confirm `/organization` redirects to `/dashboard` (guard fix behaves correctly, no console errors).

**Manual verification of a fully-entitled Organization view (nav item, sub-sidebar, company selector, placeholders) was not achieved in-browser**, because no locally-seeded tenant currently has `org_structure` active. This is a backend data gap, not a frontend defect — see §1 and §9 for the exact steps a backend owner would need to take.

### Steps to manually verify once a tenant has real `org_structure` entitlement

1. Either fix `DevSmokeTestTenantSeeder.cs:730,742` to include `org_structure` (and the other Phase 1 keys) in `SelectedModulesJson`, or run `POST /api/v1/tenants` end-to-end to create a fresh tenant after the Starter-plan migration (which does carry `org_structure` correctly).
2. Log in as that tenant's owner.
3. Confirm `GET /api/v1/auth/me` includes `"org_structure"` in `active_modules` and `"org:read"`/`"org:manage"` in `permissions`.
4. Visit `/organization` → expect redirect to `/organization/departments`, sidebar showing all 8 items with Organization highlighted, sub-sidebar showing Departments/Positions, and the topbar company selector showing the resolved company name (or "No companies"/"Company unavailable" if the legal-entities call is empty/fails).

One-off local-only SQL for manual visual verification (will not survive a backend restart, per §1):
```sql
UPDATE tenant_subscriptions
SET selected_modules_json = '["org_structure","core_hr","leave","calendar","time_attendance","worksync_foundation","projects","objectives_milestones","tasks","boards","planning_sprints"]'
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme');
```
This was **not** executed — left for the user to decide, since it touches the database rather than frontend code.

---

## 9. Known Gaps Deferred

- **Backend seed data**: `DevSmokeTestTenantSeeder.cs` hardcodes a stale module list for `acme`/`dapi`, and re-applies it on every startup. Not fixed here (backend, out of scope). Flagging for a backend-side follow-up ticket.
- Everything already deferred in the original Part 2B report remains deferred: Legal Entity General Settings (2C), Create Company modal (2D), Delete Company modal (2E), Department CRUD (2F), Position CRUD (2G), Department head position selection (2H).
- Department/Position placeholder pages remain minimal placeholders — no real data tables or API calls added, per scope.

---

## 10. Scope Confirmation

- **Backend (`C:\onevoNew\HRMS-Backend-v1`):** Read-only investigation only (migrations, seeders, DTOs, permission seeder). **No files modified.**
- **Postman collections:** Untouched.
- **OneVo-HR documentation:** Untouched.
- **Legal Entity General Settings, Create/Delete Company modals, Department/Position Management screens:** Not built.
- **Git commit / push:** None executed.
