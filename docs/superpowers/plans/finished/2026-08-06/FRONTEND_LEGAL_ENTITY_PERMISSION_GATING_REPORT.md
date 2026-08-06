# Legal Entity Permission Frontend Gating & Dev-Smoke Verification — Report

**Repos:** `Hrms--Web-application---front-end---v1` (code changed this session) and `HRMS-Backend-v1` (verified only, no code changed this session — see §3).

---

## 1. What was wrong

The topbar `CompanySelectorComponent` gated the whole selector (and, inside it, the "Add Company" menu item) on `hasOrgAccess` — `org_structure` module + `org:read`/`org:manage`. That's correct for *viewing/switching* companies, but it meant any user who could see the selector at all (including a plain HR/Work-manager-style `org:read` user) also saw a clickable "Add Company" action, even though the backend's `POST /api/v1/org/legal-entities` endpoint requires the dedicated `legal_entity:create` permission (`LegalEntitiesController.cs:50-52`). The button did nothing destructive today (it only shows a "coming in Part 2D" notification), but it advertised a capability the user didn't actually have.

## 2. Frontend files changed

- `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.ts` — added `readonly canCreateLegalEntity = computed(() => this.permissionService.hasPermission('legal_entity:create'));`, matching the exact `computed(() => permissionService.hasPermission(...))` pattern already used by `GeneralSettingsComponent.hasAccess` (`general-settings.component.ts:62`), which was used as the source-of-truth gating shape. `hasOrgAccess` is untouched — the selector itself still shows for any `org:read`/`org:manage` user.
- `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.html` — wrapped the "Add Company" divider + section (previously always rendered once the popover's data state resolved) in `@if (canCreateLegalEntity()) { ... }`. Hidden, not disabled, per the task's stated preference.
- `src/app/layouts/main-layout/top-navbar/company-selector/company-selector.component.spec.ts`:
  - Added `hasPermission: (p: string) => permissions.includes(p)` to the `PermissionService` test stub (it previously only stubbed `hasModule`/`hasAnyPermission`, which isn't enough to test a `hasPermission`-based gate).
  - Updated the existing "Add Company click → notification" test to grant `legal_entity:create` (it previously only granted `org:manage`, which no longer renders the button).
  - Added `shows Add Company for users with legal_entity:create` (visible + clickable case).
  - Added `hides Add Company for users with org:read/org:manage but not legal_entity:create` (selector still renders; Add Company item does not).
  - All other selector tests (visibility, loading/error/empty states, company switching) were left unmodified — none of them depended on Add Company visibility.

No route guards, nav config, or `PermissionService` core logic were touched — `nav-items.config.ts`'s General Settings entry already required `legal_entity:update` (pre-existing, from Part 2C) and was not part of this fix.

## 3. Backend: verified only, no code changed this session

Inspecting the `HRMS-Backend-v1` working tree showed the permission wiring this task asked for (`legal_entity:create/update/delete` under `org_structure`, correct controller attributes, dev-smoke Owner self-heal) **already implemented and uncommitted** from an earlier session — evidenced by `LEGAL_ENTITY_PERMISSION_AND_ACCESS_FILTER_REPORT.md` and `DEV_SMOKE_ORG_MODULE_PERMISSION_SEED_FIX_REPORT.md` already sitting at the backend repo root, plus matching diffs in `git status`. This session independently re-verified the claims in those reports against the actual code rather than trusting them blindly:

- `LegalEntitiesController.cs` (read directly): `GET` list → `org:read`; `GET`/`PUT` `general-settings` and `DELETE .../logo` → `legal_entity:update`; `POST` create → `legal_entity:create`; `DELETE {id}` → `legal_entity:delete`. Exactly matches the required table — no changes needed.
- `PermissionSeeder.cs:94-96` defines all three codes under module `org_structure`.
- `DevSmokeTestTenantSeeder.cs`: the seeded "Tenant Owner" role (`ResolveRolePermissionsAsync`, `explicitCodes == null` branch, lines ~547-561) grants **every** currently-seeded permission except the `"*"` bypass code, and `SeedTenantRoleAsync` additively backfills any missing `RolePermission` rows on every restart (idempotent, no duplication). Because `legal_entity:create/update/delete` are now in the permission catalog, the Owner role picks them up automatically on the next backend restart — no seeder edit was required for this task specifically. `HrManagerPermissionCodes` / `WorkManagerPermissionCodes` are explicit hardcoded lists that do **not** include any `legal_entity:*` code, so those dev-smoke roles do not gain them — confirmed by existing tests using exact-list (`BeEquivalentTo`) assertions, which would fail if an unexpected permission leaked in.
- A separate, earlier fix already in the same uncommitted working tree (`DEV_SMOKE_ORG_MODULE_PERMISSION_SEED_FIX_REPORT.md`) corrected `DevSmokeTestTenantSeeder`'s previously-hardcoded, stale `SelectedModulesJson` so `active_modules` includes `org_structure` — without that, `PermissionResolver` would strip `legal_entity:*` from the effective set even if granted, since it filters granted permissions by active module. This was a prerequisite for the legal_entity fix to actually reach `/auth/me`, and was already fixed.

**No backend source file was modified in this session.** I only read and re-verified the existing uncommitted changes and ran the backend test suites (below).

## 4. Exact permission behavior after the fix

| Surface | Requires |
|---|---|
| Company selector visible (switch companies) | `org_structure` module + (`org:read` or `org:manage`) — unchanged |
| "Add Company" item visible/clickable in the selector | `legal_entity:create` (new gate, this session) |
| `POST /api/v1/org/legal-entities` (backend) | `legal_entity:create` |
| General Settings page/nav item, `GET`/`PUT .../general-settings`, logo delete | `legal_entity:update` |
| `DELETE /api/v1/org/legal-entities/{id}` | `legal_entity:delete` |
| Dev-smoke Acme/Dapi "Tenant Owner" | gets all three `legal_entity:*` codes automatically on next backend restart (self-healing, no manual DB edit) |
| Dev-smoke HR Manager / Work Manager | do **not** get any `legal_entity:*` code (unchanged, intentional) |

## 5. Live `/auth/me` verification: not performed this session — tests only

The local backend (`ONEVO.Api`, PID confirmed running) was up during this session, but a live check would have required a full login → OTP/email → session-exchange flow for the dev-smoke owner mailbox, which wasn't practical to drive here. This task's backend claims are instead backed by:
- Unit tests explicitly asserting the Owner role's granted `RolePermission` set includes all three `legal_entity:*` permission IDs (`DefaultRoleSeederTests.SeedDefaultRolesAsync_GrantsLegalEntityPermissionsToOwner_WhenOrgStructureModuleIncluded`), and the permission catalog test (`OrgPermissionSeedTests.cs`) proving the three codes exist under `org_structure`.
- A prior session's live verification (documented in `DEV_SMOKE_ORG_MODULE_PERMISSION_SEED_FIX_REPORT.md` §3/§6) already confirmed `active_modules` includes `org_structure` and `/auth/me`'s `permissions` array is populated correctly for the same dev-smoke owner, via a real login/session-exchange run against the running backend — that reconciliation is what allows any `org_structure`-owned permission (including the new `legal_entity:*` codes) to reach `/auth/me` at all.

If you want a live re-check specifically for `legal_entity:*` in `/auth/me`, restart the backend and hit `GET /api/v1/auth/me` after a normal login as the Acme owner (`siyasiyamala932@gmail.com`) — I did not do this myself.

## 6. Test commands and results

**Frontend** (`Hrms--Web-application---front-end---v1`):
| Command | Result |
|---|---|
| `npm test -- --watch=false` | **262/262 passed**, 54 test files |
| `npm run build` | Success, 0 errors |
| `npm run build:staging` | Success, 0 errors |
| `git diff --check` | Clean (only pre-existing LF→CRLF warnings on unrelated files, no whitespace-conflict errors) |

**Backend** (`HRMS-Backend-v1`, verification only — no source changed):
| Command | Result |
|---|---|
| `dotnet build src/ONEVO.Api/ONEVO.Api.csproj --no-restore --verbosity minimal` | Success, 0 errors |
| `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --no-restore --verbosity minimal` | **1422/1422 passed** |
| `dotnet test tests/ONEVO.Tests.Architecture/ONEVO.Tests.Architecture.csproj --no-restore --verbosity minimal` | **536/536 passed** |
| `dotnet test tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj --filter "FullyQualifiedName~ApiBootTests\|FullyQualifiedName~LegalEntities\|FullyQualifiedName~DevSmoke"` (Docker/Testcontainers) | **27/27 passed** (10m15s) |
| `git diff --check` | Clean (only pre-existing LF→CRLF warnings, no whitespace-conflict errors) |

## 7. Remaining risks

1. **Backend changes are still uncommitted from a prior session**, alongside this session's frontend changes and other unrelated pre-existing uncommitted work in both repos (auth root-host/legal-consent/theme changes in frontend; Postman files in backend). Nothing was committed or pushed by this task — the user should review both working trees before committing, since they contain more than just this task's diff.
2. **Existing production-tenant permission backfill gap** (documented in `LEGAL_ENTITY_PERMISSION_AND_ACCESS_FILTER_REPORT.md` §6): tenants provisioned *before* the `legal_entity:*` catalog change won't retroactively get it on their Owner role without a manual/migration backfill. Only the dev-smoke seeder self-heals; this is a pre-existing, already-flagged gap, not something introduced or fixed by this task.
3. **No live `/auth/me` check specific to `legal_entity:*`** was performed this session (see §5) — confidence rests on unit-test assertions plus a prior session's live check of the same code path for `org:read`/`org:manage`, not a fresh end-to-end run.
4. Frontend gating is UI-only defense-in-depth; the backend's `[RequirePermission("legal_entity:create")]` attribute on `POST /api/v1/org/legal-entities` is the actual enforcement boundary (already verified in §3).

## 8. Explicit scope statement

**Nothing was committed or pushed in either repository during this session.** All changes described above are in the two working trees only. No auth/legal-acceptance root-host logic, session-exchange logic, database schema, logo/upload code, or `country_id`/countries-table code was touched. No new permissions beyond `legal_entity:create/update/delete` (which already existed in the working tree before this session) were introduced. No tenant ID was added to any frontend request body.
