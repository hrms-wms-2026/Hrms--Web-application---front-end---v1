# Frontend Organization / Settings — Audit and Implementation Plan (Part 1)

> **Scope of this document:** Audit + plan only. No frontend or backend source file was created, edited, deleted, formatted, renamed, or moved to produce this report. This is the only file this task touched.

---

## 1. Repository / Branch State

**Command:** `git -C "C:\onevoNew\Hrms--Web-application---front-end---v1" status --short && git -C "C:\onevoNew\Hrms--Web-application---front-end---v1" branch --show-current`
**Result:** clean working tree, branch `Development` (matches the target branch — no checkout was needed or performed).

**Command:** `git -C "C:\onevoNew\HRMS-Backend-v1" status --short && git -C "C:\onevoNew\HRMS-Backend-v1" branch --show-current`
**Result:** branch `feature/mkcert-tenant-subdomain-https`. This repo is read-only reference for this task; nothing was changed in it.

**Package manager / scripts** (`package.json`):
- `packageManager: "npm@11.9.0"`. Only `package-lock.json` present — no `yarn.lock` / `pnpm-lock.yaml`.
- `start`: `ng serve --ssl true --ssl-cert .certs/localhost-cert.pem --ssl-key .certs/localhost-key.pem --host 0.0.0.0 --port 4200`
- `build`: `ng build` / `build:staging`: `ng build --configuration staging`
- `watch`: `ng build --watch --configuration development`
- `test`: `ng test` (Angular's built-in `@angular/build:unit-test` builder — Vitest under the hood; no separate `vitest.config.*` found, no Jest despite the architecture doc's Jest examples)
- `e2e` / `e2e:ui`: Playwright
- **No `lint` script.** No ESLint config file found anywhere in the repo root.

**Angular version:** `^21.2.0` across `@angular/core|common|compiler|forms|platform-browser|router`, `@angular/cli` / `@angular/build` `^21.2.19`. `@ngrx/signals ^21.1.1`, `rxjs ~7.8.0`, `tailwindcss ^4.3.3` + `@tailwindcss/postcss`, TypeScript `~5.9.2`.

No `npm install`, no dev server, and no test suite were run for this audit (per task instructions).

---

## 2. Routing

**File:** `src/app/app.routes.ts`

```
''  (MainLayoutComponent, canActivate: [authGuard])
  ├─ 'dashboard'  → modules/dashboard/feature/dashboard-home/dashboard-home.component.ts
  └─ ''  → redirectTo 'dashboard'
'auth'  (AuthLayoutComponent)
  ├─ 'login'          → core/auth/feature/login/login.component.ts
  ├─ 'legal-consent'  → core/auth/feature/legal-consent/legal-consent.component.ts
  ├─ 'continue'       → core/auth/feature/session-exchange/session-exchange.component.ts
  └─ ''  → redirectTo 'login'
'**' → redirectTo 'auth/login'
```

- Every route entry uses `loadComponent()` — all lazy-loaded, consistent with the architecture doc.
- **No `settings/`, `organization/`, or `general/` routes exist anywhere in the repo.** No `modules/organization/` or `modules/settings/` directory exists — the only real module folder is `modules/dashboard/`.
- **Where Settings plugs in:** as a new sibling of `dashboard` inside the `''` (MainLayoutComponent) block, e.g. `path: 'settings'` with `loadChildren` to a new `modules/organization/organization.routes.ts` (module-per-domain, per the architecture doc's canonical template). This keeps it inside the existing `authGuard`-protected shell.
- **Guards:** only `authGuard` exists (`src/app/core/guards/auth.guard.ts`), and it is purely session-based — it calls `AuthStore.checkSession()` (`GET /auth/me`) and redirects to `/auth/login` on failure. **There is no permission-based route guard anywhere in the repo** (no `role.guard.ts`, no `permission.guard.ts`, despite `AuthState.permissions: string[]` already being populated from `/auth/me`). This is a real gap the architecture doc's `role.guard.ts` example does not match — that example checks `user.roles`, but the actual `AuthState` shape has no `roles` field, only `permissions`. Any guard built for Settings must be permission-string-based (`org:read` / `org:manage`), not role-based.

---

## 3. Auth / Session Exchange Flow

**Files inspected:** `core/auth/data-access/auth-api.service.ts`, `core/auth/state/auth.store.ts`, `core/guards/auth.guard.ts`, `core/auth/utils/tenant-redirect.ts`, `core/auth/feature/session-exchange/session-exchange.component.ts`, `environments/*`, `environments/environment-url.helper.ts`.

- **Base-domain login:** `AuthApiService.login()` explicitly retargets the request to the system/root host via `getSystemApiUrl(environment.apiUrl)` (which rewrites the hostname through `getRootHostname()`), regardless of what subdomain the SPA is currently on. `POST {rootHost}/api/v1/auth/login`.
- **Tenant redirect / session exchange:** on a fully-authenticated login response, `AuthStore` sets `redirectRequired`/`continueUrl`/`workspaceSlug`; the app is expected to navigate the browser to the tenant subdomain's `continue_url` (`buildTenantUrl()` in `tenant-redirect.ts` constructs `{protocol}//{slug}.{rootHost}{port}{path}`). `SessionExchangeComponent` (route `auth/continue`) reads `?code=` from that URL and calls `AuthStore.exchangeSession(code)` → `AuthApiService.sessionExchange()` → `POST {currentHost}/api/v1/auth/session-exchange` (deliberately **not** retargeted to system host — comment in `auth-api.service.ts:36-40` is explicit this must run on the tenant host that `continue_url` navigated to). This is the call that actually establishes the `onevo_session`/`onevo_csrf` cookies, per the code comment on `AuthStore.exchangeSession` (`auth.store.ts:133-137`). Login itself does **not** set the tenant session cookie.
- **Cookies:** `authInterceptor` (`core/interceptors/auth.interceptor.ts`) unconditionally clones every request with `withCredentials: true` — it does not read or inspect any cookie itself; the browser handles cookie storage.
- **HTTPS:** local dev is HTTPS-only by design — `npm start` runs `ng serve --ssl true` against `.certs/localhost-cert.pem`/`.certs/localhost-key.pem`, and `environment.ts` (`buildLocalApiUrl`) hardcodes `https:` + a fixed local backend port `7229` (`environment-url.helper.ts:31-38`). There is no HTTP fallback path and no branching on `window.location.protocol` for local dev — comments in `environment.ts:4-7` state this explicitly. No stale `http://` or `5139` references were found anywhere in `src/`.
- **`/auth/me` usage:** `AuthStore.checkSession()` calls `AuthApiService.me()` → `GET /api/v1/auth/me`, used only by `authGuard` today. There is no separate "refresh" endpoint call anywhere in the frontend (no `/auth/refresh`) — this diverges from the architecture doc's §7.3 token-refresh-flow example, which assumes an `auth.refresh()` call on 401. The actual `error.interceptor.ts` does **not** call any refresh endpoint; on a non-exempt 401 it just clears the session and redirects to `/auth/login` (see §4/§7 below). This is a doc-vs-code mismatch worth flagging, not a Settings-blocking gap.
- **Gaps relevant to Settings:** none block building Settings screens — `checkSession()`/`authGuard` already gate the whole authenticated shell, and `AuthState.permissions` is already populated for a future permission guard/directive to consume.

---

## 4. CSRF and HTTP Client Style

**File:** `core/interceptors/csrf.interceptor.ts`

- Reads cookies named `onevo_csrf` or `onevo_legal_csrf`, and — **only for non-safe methods** (anything not `GET`/`HEAD`/`OPTIONS`) — sets header `X-CSRF-Token` with the (URL-decoded) cookie value. If no matching cookie is found, the request proceeds **without** the header (no error thrown client-side; the backend would reject it).
- This is a single client with no tenant/admin split in this repo — the ONEVO Customer Application and ONEVO Developer Platform are separate, independently-deployed repos per `ONEVO_HRMS_Frontend_Architecture.md` §1, so there is nothing to separate here.
- **Architecture-doc mismatch:** `ONEVO_HRMS_Frontend_Architecture.md` §6.2 documents a `XSRF-TOKEN` cookie / `X-XSRF-TOKEN` header double-submit pattern. The actual code uses `onevo_csrf`/`onevo_legal_csrf` cookies and an `X-CSRF-Token` header. **Follow the actual code (`csrf.interceptor.ts`), not the doc**, when Settings mutation calls (POST/PUT/DELETE on companies/departments/positions) are implemented — no new interceptor is needed, the existing one already covers any `HttpClient` call made through the standard `provideHttpClient` pipeline.
- **Interceptor registration order** (`app.config.ts`): `authInterceptor → correlationInterceptor → csrfInterceptor → errorInterceptor`. All four are registered (the doc's 5th, `loggingInterceptor`, does not exist in code — not a gap, just unimplemented/unplanned).
- **Request/response conventions:** no shared `ApiResponse<T>` / `PaginatedResponse<T>` wrapper types exist in `shared/models/` today (only `problem-details.model.ts` does). Backend responses for OrgStructure (see §9) are **not** wrapped in an `{ data, message, success }` envelope — they are the raw DTO/array/page object. Any new `data-access` service for Settings should type responses directly against the backend DTO shapes in §9, not against the architecture doc's `ApiResponse<T>` example.
- Error handling convention: `error.interceptor.ts` retries 5xx/network errors up to 3 times with `[250, 500, 1000]`ms backoff, treats `401` on `/auth/login`/`/auth/me` as "pass through" (session-exempt), otherwise clears the session + redirects to login on `401`, and otherwise forwards to `ErrorHandlerService.handle()`. **No `403` handling is implemented in `error.interceptor.ts` or `ErrorHandlerService`** — this matters directly for Settings, since `org:manage`-gated actions (see §10) will return `403` for users who lack the permission, and today that just falls through to `errorHandler.handle()`'s generic unknown-error path (no banner text specific to 403 was found in `error-handler.service.ts` beyond what's in the doc's example taxonomy, which is not implemented in code — confirm against `error-handler.service.ts` before relying on a specific 403 message).

---

## 5. Environment / HTTPS / Tenant Host Handling

**Files:** `src/environments/environment.ts`, `environment.prod.ts`, `environment.staging.ts`, `environment-url.helper.ts`, `core/config/app.config.ts`, `core/config/runtime-config.model.ts`.

- **Root vs. tenant host:** the frontend never branches on hostname to decide "am I root or tenant" — it always calls the backend on **whatever host the Angular app itself is currently on** (`window.location.hostname`), because `HostTenantResolutionMiddleware` on the backend resolves tenant context purely from the request's `Host` header (documented in code comments in `environment.ts:9-17` and `environment.prod.ts:4-12`). The one exception is `AuthApiService.login()`, which explicitly retargets to the root host via `getSystemApiUrl()`/`getRootHostname()` since login is root-only.
- **Dev HTTPS/local host handling:** `environment.ts` builds `https://{currentHostname}:7229/api/v1` — i.e., same hostname as the SPA, fixed backend port 7229, always HTTPS. This is correct for both `localhost` and `{slug}.localhost` dev hosts, matching the mkcert HTTPS setup already completed (per prior session's memory of `acme.localhost`/`dapi.localhost` trust setup — not re-verified in this audit since it's out of scope, but the code is consistent with it).
- **Prod/staging:** same-origin, no fixed port, protocol/hostname taken from `window.location` — assumes a reverse proxy routes `/api` and `/ws` through without rewriting `Host`.
- **No hardcoded `http://` or stale `5139` references** found in `src/` (checked via full-repo `.ts` file listing and read of all environment files).
- **WebSocket URL:** `buildWsUrl`/`buildLocalWsUrl` exist and are wired into `environment.wsUrl`, but no `WebSocketService` or any consumer of `environment.wsUrl` exists yet anywhere in `src/` — irrelevant to Settings, noted only for completeness.

---

## 6. Current Layout / Sidebar / Topbar

**Files:** `layouts/main-layout/*`, `layouts/main-layout/side-navbar/*`, `layouts/main-layout/top-navbar/*`, `shared/ui/home-page-profile-capsule/*`, `layouts/auth-layout/*`.

- **`MainLayoutComponent`** (`main-layout.component.html`): CSS grid shell — `<app-side-navbar />`, `<app-top-navbar [email]="email()" />`, a `<main>` router outlet, a skip-link, and empty global notification/dialog container `<div>`s (no `NotificationService`/`DialogService` render target is wired to them yet — the containers exist but nothing renders into them). `MainLayoutComponent` only injects `AuthStore` and exposes `email`; it does not know about `userName`, so `TopNavbarComponent`'s `userName` input is never actually bound from here (`top-navbar.component.html` only receives `email`, per `main-layout.component.html:7`) — a small existing gap to be aware of if a company selector or profile popover need more than email.
- **`SideNavbarComponent`**: `<nav aria-label="Main navigation"></nav>` — **completely empty**, no nav items, no icons, no active-state logic. This is where the primary app navigation (Dashboard, Organization/Settings, etc.) needs to be built from scratch; there is no existing "nav item" pattern to reuse.
- **`TopNavbarComponent`**: renders only `<app-home-page-profile-capsule [userName] [email] />`. **This capsule is a static, non-interactive pill** — `home-page-profile-capsule.component.ts` has no `output()`, no click handler, no `aria-haspopup`/`aria-expanded`, and its template (not fully re-quoted here, confirmed via the `.ts`/`.css` pair) is a plain `<div>`/span rendering `displayText()`. **No profile popover, dropdown, or menu component exists anywhere in the repo.** The "click avatar → popover → Appearance section" flow described in the task must be built entirely new: a new `shared/ui` popover/menu primitive plus a new feature component that lives in `top-navbar` (or a new `shared/ui/profile-menu/`) that composes it.
- **Company selector:** does not exist. Given `TopNavbarComponent` currently only takes `email`, the natural home for a company/legal-entity selector is next to (or inside) the top navbar, sourced from a new `state/` store — see Part 2B below.
- **`AuthLayoutComponent`**: unrelated to Settings (login/legal-consent/session-exchange only), noted for the hardcoded-color finding in §7.

---

## 7. Component / Style Conventions

**Files:** `shared/ui/button|card|loader`, `styles.css`, `layouts/*/**.css`, `postcss.config.json`.

- **Tailwind 4, CSS-first config** (`@import "tailwindcss";` in `styles.css`, `@tailwindcss/postcss` in `postcss.config.json`). **No `tailwind.config.*` file exists** — meaning there is no `theme.extend.colors` / semantic token registration in Tailwind itself (the architecture doc's §9.2 `tailwind.config.ts` example with a `brand` palette is **not implemented**).
- **The only centralized tokens that exist** are seven CSS custom properties in `styles.css:3-12`: `--dashboard-surface-color`, `--dashboard-background-color`, `--dashboard-text-primary`, `--dashboard-text-secondary`, `--dashboard-border-color`, `--dashboard-profile-background`, `--dashboard-profile-text`, `--dashboard-content-radius`. These are consumed by exactly two files: `main-layout.component.css` and `home-page-profile-capsule.component.css`. Everything else ignores them.
- **Existing reusable UI:** only three components in `shared/ui/`: `button` (`primary`/`secondary` variants, hardcodes `bg-slate-900`/`bg-white`/`border-slate-300` Tailwind utility classes directly in the component's `classes()` method — not driven by any CSS variable), `card` (hardcodes `border-slate-200`/`bg-white`/`text-slate-900`), `loader` (hardcodes `border-slate-300`/`border-t-slate-600`). **No table, modal, select, input, or badge component exists.** Login/legal-consent/session-exchange forms also hardcode `text-slate-700`, `border-slate-300`, `text-red-600` Tailwind classes directly in their templates.
- **Concrete hardcoded-color violations found** (`#`/`rgb(` grep across `src/`, 3 files matched):
  - `styles.css:4-9` — the `--dashboard-*` variables themselves are hardcoded hex (expected; this is the one place they *should* live, but the naming (`dashboard-*`) is dashboard-specific, not a generic app-wide token set — needs renaming/generalizing for a real theme system).
  - `main-layout.component.css:12-13` — skip-to-main link hardcodes `background: #ffffff; color: #111827;` instead of referencing any variable.
  - **`auth-layout.component.css:11` — `.auth-layout { background: #e80c0c; }`** — a bright red full-page background on the entire auth layout (login/legal-consent/session-exchange screens). This reads as leftover debug/placeholder styling and is the single starkest hardcoded-color anti-pattern found in the repo. It is out of this task's scope to fix (audit only), but it directly contradicts the "theme must be centralized, no hardcoded colors" requirement and should be flagged to whoever owns the auth screens.
- **Tailwind utility-class color counts** (`bg-slate|text-slate|border-slate|bg-white|bg-gray|text-gray`, count mode): 14 occurrences across `loader.component.ts`, `card.component.ts`, `button.component.ts`, `login.component.html`, `legal-consent.component.html`, `session-exchange.component.html` — i.e. **every existing shared/ui component and every existing form template** hardcodes Tailwind slate/gray/white utility classes rather than referencing CSS variables or Tailwind theme tokens.
- **What needs to exist before building Settings screens:** (a) a real token system — either a `tailwind.config` `@theme` block (Tailwind 4 CSS-first) defining semantic color tokens (`--color-surface`, `--color-accent`, `--color-border`, etc., independent of "dashboard" naming) or an expanded `:root` variable set in `styles.css`, consumed by `shared/ui` components instead of hardcoded `slate-*`/hex values; (b) `shared/ui/input`, `shared/ui/select`, `shared/ui/modal`, `shared/ui/table` — none exist and Settings (General Settings form, Create/Delete Company modals, Departments/Positions tables) needs all four; (c) the button/card/loader components retrofitted to consume the new tokens instead of hardcoded slate classes, so Settings doesn't add a fourth hardcoded-color surface.
- **No anti-patterns beyond hardcoded colors were found** (no duplicate button implementations, no oversized components — the codebase is small and mostly skeletal; "cards inside cards" doesn't yet apply since there's only one real page, dashboard-home, which is an empty `<div>`).

---

## 8. Existing API Service / State Conventions

**Files:** `core/auth/data-access/auth-api.service.ts`, `core/auth/state/auth.store.ts`, `core/auth/models/dto/*`, `core/auth/models/view/*`, `core/auth/utils/auth.mapper.ts`.

- **`data-access/` location:** `core/auth/data-access/auth-api.service.ts` is the only example. It is `@Injectable({ providedIn: 'root' })`, injects `HttpClient`, and returns raw `Observable<T>` (no envelope unwrapping) built from `API_ENDPOINTS` (`core/config/api-endpoints.ts`) + `environment.apiUrl`. **No domain module `data-access/` folder exists yet** (no `employees-api.service.ts`, etc., despite `API_ENDPOINTS.employees`/`API_ENDPOINTS.projects` placeholder entries already existing in `api-endpoints.ts` — those are unused stubs, not a real convention to copy verbatim).
- **Model naming:** `models/dto/*.dto.ts` for wire-format request/response types (e.g. `login-request.dto.ts`, `auth-response.dto.ts`), `models/view/*.view-model.ts` for the UI-facing shape (`current-user.view-model.ts`), and `utils/*.mapper.ts` (`auth.mapper.ts`) to convert DTO → view-model. This 3-tier split (dto → mapper → view-model) is a real, deliberate pattern worth following for a `LegalEntityStore`/`DepartmentStore`/`PositionStore`, even though the architecture doc's example (`employee.store.ts`) skips the mapper step and consumes the DTO shape directly in state.
- **Store structure:** `AuthStore` = `signalStore({ providedIn: 'root' }, withState<AuthState>(...), withMethods((store, api = inject(...)) => ({ ...async methods using firstValueFrom + patchState... })))`. **No `withComputed` usage exists yet anywhere** (the architecture doc's `employee.store.ts` example uses it; nothing in the actual codebase does). **`@ngrx/signals` is a real, installed dependency and is the only state-management approach used** — confirms the task's instruction ("use Signal Store if the repo already uses it") applies directly; no `BehaviorSubject` was found anywhere in `src/` for domain/module state, so there is nothing to document an exception for.
- **Loading/error state:** flat `loading: boolean` / `error: string | null` fields directly in `AuthState`, set via `patchState` at the start/catch of each async method — no separate loading-state service, no request-cancellation pattern, no optimistic-update pattern demonstrated anywhere yet.
- **Pagination/list handling:** **no precedent exists anywhere in the frontend.** `dashboard-home.component.ts` is an empty skeleton; no list/table page has ever been built. The Departments/Positions list-with-pagination UI (§9 shows the backend returns `{ items, page, pageSize, totalCount, totalPages }`) will be the *first* paginated list in this codebase — there is no existing pattern to reuse or diverge from, only the backend's actual page-response shape to design against.
- **Error message extraction:** `AuthStore`'s private `extractErrorMessage()` helper (`auth.store.ts:39-54`) reads `HttpErrorResponse.error.detail`/`.message`/`.title`/`.errors[key]` (ASP.NET Core `ProblemDetails`/validation-error shape) — this is a reusable pattern (currently duplicated only in `AuthStore`) worth promoting to a shared helper before Settings adds 3+ more stores that will need the same FluentValidation-error-shape parsing (see the validators in §9).

---

## 9. Backend Endpoint Truth

All endpoints below are `[Authorize(Policy = "TenantPolicy")]` (tenant-scoped session cookie required) plus a per-action `[RequirePermission("org:read"|"org:manage")]` attribute (see §10). Source: `HRMS-Backend-v1/src/ONEVO.Api/Controllers/Tenant/OrgStructure/{LegalEntitiesController,DepartmentsController,PositionsController}.cs`.

### Legal Entities / Companies — base route `api/v1/org/legal-entities`

| Method | Path | Permission | Request body | Response | Source |
|---|---|---|---|---|---|
| GET | `/api/v1/org/legal-entities?includeInactive={bool}` | `org:read` | — | `LegalEntityListItemResponse[]`: `{ id, name, companyCode?, logoFileId?, isActive, isPrimary }` | `LegalEntitiesController.cs:29-37`; `LegalEntityListItemResponse.cs` |
| GET | `/api/v1/org/legal-entities/{id}/general-settings` | **`org:manage`** (not `org:read`) | — | `LegalEntityGeneralSettingsResponse` (see below) | `LegalEntitiesController.cs:39-48`; `LegalEntityGeneralSettingsResponse.cs` |
| POST | `/api/v1/org/legal-entities` | `org:manage` | `CreateLegalEntityRequest`: `{ name, companyCode?, registrationNumber, countryCode, currencyCode, taxRegistrationNumber?, registeredBusinessAddress?, parentLegalEntityId? }` | `LegalEntityGeneralSettingsResponse` (201, reused verbatim as the create response) | `LegalEntitiesController.cs:50-70`; `CreateLegalEntityRequest.cs` |
| PUT | `/api/v1/org/legal-entities/{id}/general-settings` | `org:manage` | `UpdateLegalEntityGeneralSettingsRequest` (full-field, see below) | `LegalEntityGeneralSettingsResponse` | `LegalEntitiesController.cs:72-107`; `UpdateLegalEntityGeneralSettingsRequest.cs` |
| DELETE | `/api/v1/org/legal-entities/{id}` | `org:manage` | `DeleteLegalEntityRequest`: `{ confirmName }` | 204 No Content | `LegalEntitiesController.cs:109-118`; `DeleteLegalEntityRequest.cs` |
| DELETE | `/api/v1/org/legal-entities/{id}/logo` | `org:manage` | — | 204 No Content | `LegalEntitiesController.cs:120-129` |

**`LegalEntityGeneralSettingsResponse`** (`LegalEntityGeneralSettingsResponse.cs`): `{ id, name, companyCode?, logoFileId?, registrationNumber?, taxRegistrationNumber?, vatGstNumber?, email?, phoneNumber?, website?, countryCode, currencyCode, timezone?, financialYearStartMonth, firstDayOfWeek, standardWorkingDays: int[], defaultLanguage, dateFormat, timeFormat, status, registeredBusinessAddress?: LegalEntityAddressDto }`.

**`UpdateLegalEntityGeneralSettingsRequest`** (`UpdateLegalEntityGeneralSettingsRequest.cs`, all required unless marked `?`): `{ name, companyCode, registrationNumber, taxRegistrationNumber?, vatGstNumber?, email?, phoneNumber?, website?, countryCode, currencyCode, timezone, financialYearStartMonth, firstDayOfWeek, standardWorkingDays: int[], defaultLanguage, dateFormat, timeFormat, status, registeredBusinessAddress? }`. Note it deliberately **excludes `parentLegalEntityId`** — only Create collects it (code comment, `UpdateLegalEntityGeneralSettingsRequest.cs:5-8`).

**`LegalEntityAddressDto`** (`LegalEntityAddressDto.cs`): `{ line1?, line2?, city?, state?, postalCode?, country? }` — free-text `country` string field, reused by both request and response.

**Country field reality:** there is **no `country_id` / `countries` lookup table anywhere in the backend** (repo-wide grep confirmed). `CountryCode` on the Legal Entity is a plain string, validated as `MaximumLength(3)` ("must be an ISO 3166-1 alpha-3 code" — format is documented in the validation message only, **not enforced by an allow-list**). Do not build a country picker backed by a `country_id` FK or a `/countries` endpoint — neither exists. A free-text/ISO-alpha-3 input (optionally against a frontend-local static ISO-3166 list for a dropdown UX) is the only backend-consistent option today.

**Logo:** `SetLegalEntityLogoRequest` (`{ fileId }`) exists as a DTO, but **the corresponding `PUT /{id}/logo` endpoint is explicitly not exposed** on the controller — the code comment (`LegalEntitiesController.cs:15-18`) states this was deliberate: the command handler sets `LogoFileId` with no tenant-ownership/purpose validation, and `IFileStorageService` has no lookup method to make that safe without a Storage-feature change out of scope. Only `DELETE /{id}/logo` (remove) is live. **Do not build a logo upload UI in Part 2C** — there is nothing to call. Logo *removal* is technically callable but has no matching upload path, so it's not useful in isolation either; treat the whole logo feature as backend-incomplete and out of scope for this plan.

### Departments — base route `api/v1/org/legal-entities/{legalEntityId}/departments`

| Method | Path | Permission | Request body | Response | Source |
|---|---|---|---|---|---|
| GET | `/{legalEntityId}/departments?search=&includeInactive=&parentDepartmentId=&view=flat|tree&sortBy=name&sortDirection=asc&page=1&pageSize=25` | `org:read` | — | `view=flat` (default) → `DepartmentListPageResponse`: `{ items: DepartmentListItemResponse[], page, pageSize, totalCount, totalPages }`. `view=tree` → `DepartmentTreeNodeResponse[]` (ignores `parentDepartmentId`/`page`/`pageSize`) | `DepartmentsController.cs:28-57` |
| GET | `/{legalEntityId}/departments/{departmentId}` | `org:read` | — | `DepartmentResponse` | `DepartmentsController.cs:59-71` |
| POST | `/{legalEntityId}/departments` | `org:manage` | `CreateDepartmentRequest`: `{ name, code?, parentDepartmentId?, headPositionId? }` — **`headPositionId` is rejected with a 409 Conflict if non-null** (see below) | `DepartmentResponse` (201) | `DepartmentsController.cs:73-93`; `CreateDepartmentRequest.cs` |
| PUT | `/{legalEntityId}/departments/{departmentId}` | `org:manage` | `UpdateDepartmentRequest`: `{ name, code?, parentDepartmentId?, headPositionId? }` | `DepartmentResponse` | `DepartmentsController.cs:95-117` |
| POST | `/{legalEntityId}/departments/{departmentId}/archive` | `org:manage` | — | 204 No Content | `DepartmentsController.cs:119-133` |
| POST | `/{legalEntityId}/departments/{departmentId}/archive-check` | `org:read` | — | `DepartmentArchiveDependencyResponse`: `{ departmentId, canArchive, blockers: DepartmentArchiveBlockers, message }` | `DepartmentsController.cs:135-151` |
| POST | `/{legalEntityId}/departments/{departmentId}/restore` | `org:manage` | — | 204 No Content (409 if parent is missing/inactive) | `DepartmentsController.cs:153-167` |
| DELETE | `/{legalEntityId}/departments/{departmentId}` | `org:manage` | — | 204 No Content — **deprecated alias for Archive**, same soft-deactivation, kept only for back-compat | `DepartmentsController.cs:169-185` |

`DepartmentResponse`/`DepartmentListItemResponse` (`DepartmentResponse.cs`, `DepartmentListItemResponse.cs`): `{ id, legalEntityId, name, code?, parentDepartmentId?, headPositionId?, isActive, createdAt, updatedAt? }`. `DepartmentTreeNodeResponse` adds `children: DepartmentTreeNodeResponse[]`.

**Department-head assignment flow — confirmed, matches the task's caution exactly:** `CreateDepartmentCommandHandler.cs:45-54` explicitly **rejects** `Create` with `headPositionId` set (`409 Conflict`, message: *"Head position cannot be assigned while creating a department. Create the department first, then assign its head position through update."*). The reason is structural, not a business-rule choice: `CreatePositionRequest` requires a `departmentId` (a position must belong to an existing department), so a brand-new department has zero eligible positions to point at as its head. **The only valid frontend flow is: create department (no head) → create position(s) in that department → `PUT .../departments/{id}` with `headPositionId` set.** Do not build a head-position picker on the Create Department form (Part 2F); it belongs only on Update, gated behind Positions already existing for that department (Part 2H).

### Positions — base route `api/v1/org/legal-entities/{legalEntityId}/positions`

| Method | Path | Permission | Request body | Response | Source |
|---|---|---|---|---|---|
| GET | `/{legalEntityId}/positions?departmentId=&search=&includeInactive=&page=1&pageSize=25&sortBy=name&sortDirection=asc` | `org:read` | — | `PositionPageResponse`: `{ items: PositionListItemResponse[], page, pageSize, totalCount, totalPages }` | `PositionsController.cs:29-52` |
| GET | `/{legalEntityId}/positions/tree?includeInactive=` | `org:read` | — | `PositionTreeNodeResponse[]` | `PositionsController.cs:54-66` |
| GET | `/{legalEntityId}/positions/{positionId}` | `org:read` | — | `PositionResponse` | `PositionsController.cs:68-80` |
| POST | `/{legalEntityId}/positions` | `org:manage` | `CreatePositionRequest`: `{ departmentId, name, code, positionType, maxOccupancy, reportsToPositionId? }` | `PositionResponse` (201) | `PositionsController.cs:82-104`; `CreatePositionRequest.cs` |
| PUT | `/{legalEntityId}/positions/{positionId}` | `org:manage` | `UpdatePositionRequest`: same shape as Create | `PositionResponse` | `PositionsController.cs:106-130` |
| POST | `/{legalEntityId}/positions/{positionId}/archive-check` | `org:read` | — | `PositionArchiveBlockers`-based response (see below) | `PositionsController.cs:132-144` |
| POST | `/{legalEntityId}/positions/{positionId}/archive` | `org:manage` | — | 204 No Content | `PositionsController.cs:146-158` |
| POST | `/{legalEntityId}/positions/{positionId}/restore` | `org:manage` | — | 204 No Content | `PositionsController.cs:160-172` |

`PositionResponse` (`PositionResponse.cs`): `{ id, legalEntityId, departmentId?, name, code?, positionType, maxOccupancy, reportsToPositionId?, isActive, createdAt, updatedAt?, departmentName?, reportsToPositionName?, childCount }` — note `departmentName`/`reportsToPositionName` are pre-joined for display, no extra lookups needed for a list/table. `PositionTreeNodeResponse` swaps `children: PositionTreeNodeResponse[]` in place of the audit timestamps.

`PositionArchiveBlockers` (`PositionArchiveBlockers.cs`): `{ activeOccupants: int?, activeOccupantsCheckSupported: bool, headOfDepartments, activeChildPositions }` with computed `canArchive = headOfDepartments == 0 && activeChildPositions == 0`. **`activeOccupants` is nullable and `activeOccupantsCheckSupported` is `false`** — no `position_assignments`/employee-position table exists in the backend yet (code comment, `PositionArchiveBlockers.cs:3-7`), so occupancy can't be verified; the archive-check UI must render this as "not checked" rather than implying zero occupants.

**Validation (both Create/Update Legal Entity, `FluentValidation`):** `name` required ≤200 chars; `companyCode` required ≤20; `registrationNumber` required ≤50; `countryCode`/`currencyCode` required ≤3 chars; on Update only: `timezone` required ≤50, `financialYearStartMonth` 1–12, `firstDayOfWeek` 1–7, `standardWorkingDays` non-empty/valid-weekday/no-duplicates, `defaultLanguage` required ≤10, `dateFormat` required ≤20, `timeFormat` must be `'12h'`/`'24h'`, `status` must be `'active'`/`'inactive'`; optional fields (`taxRegistrationNumber` ≤80, `vatGstNumber` ≤50, `email` valid+≤254, `phoneNumber` ≤20, `website` ≤255+valid absolute URI) only validated when present. `parentLegalEntityId`, if provided on Create, must not be `Guid.Empty`. Source: `UpdateLegalEntityGeneralSettingsCommandValidator.cs`, `CreateLegalEntityCommandValidator.cs`.

**Delete Company rule (Part 2E), confirmed exact:** `DeleteLegalEntityCommandHandler.cs:35-40` — `confirmName` is compared with `StringComparison.Ordinal` (case-sensitive exact match) against the entity's current `Name`; if it doesn't match, `Failure("Company name confirmation does not match.")`. Separately, if the entity `IsActive` and the tenant's active-company count is `<= 1`, `Failure("Cannot delete or deactivate the last active company in the tenant.")`. This is a **soft delete** (`IsActive = false`, row preserved) — never a physical row removal.

**Response casing:** no `PropertyNamingPolicy` override was found on the main MVC/controller JSON pipeline (only `ExceptionHandlerMiddleware.cs:96` sets `JsonNamingPolicy.CamelCase`, for its own hand-built error payloads). ASP.NET Core's default controller JSON serialization is camelCase, so treat all response fields above as camelCase on the wire (`id`, `isActive`, `headPositionId`, etc.) as written.

---

## 10. Permissions

Confirmed via `[RequirePermission("...")]` attributes on every OrgStructure controller action (`RequirePermissionAttribute.cs` — an `IAuthorizationFilter` checking `ICurrentUser.HasPermission(permission)`, returning a `403` ProblemDetails-shaped body `{ type, title: "Forbidden", status: 403, detail }` on failure, or `401 Unauthorized` if `ICurrentUser` is missing/not authenticated). Only two permission strings exist for this feature area: `org:read`, `org:manage`.

| Frontend screen / action | Required permission | Source |
|---|---|---|
| View company selector (list companies) | `org:read` | `LegalEntitiesController.cs:30` |
| **View General Settings page** | **`org:manage`** | `LegalEntitiesController.cs:41` |
| Save General Settings | `org:manage` | `LegalEntitiesController.cs:74` |
| Create company | `org:manage` | `LegalEntitiesController.cs:52` |
| Delete company | `org:manage` | `LegalEntitiesController.cs:111` |
| Remove company logo | `org:manage` | `LegalEntitiesController.cs:122` |
| View departments (list/get) | `org:read` | `DepartmentsController.cs:34, 61` |
| Department archive-check | `org:read` | `DepartmentsController.cs:140` |
| Create/update/archive/restore/delete department | `org:manage` | `DepartmentsController.cs:75, 97, 123, 157, 175` |
| View positions (list/get/tree) | `org:read` | `PositionsController.cs:32, 56, 70` |
| Position archive-check | `org:read` | `PositionsController.cs:134` |
| Create/update/archive/restore position | `org:manage` | `PositionsController.cs:84, 108, 148, 163` |

**Non-obvious finding:** unlike everything else that's read-only, **viewing a single company's General Settings requires `org:manage`, not `org:read`** — a user with only `org:read` can see the company selector list (name/logo/active flag) but gets `403` opening the settings detail page. The frontend permission guard/directive (Part 2A) must special-case this: gate the General Settings route/page behind `org:manage`, not the weaker `org:read` that gates the selector and the Departments/Positions list views.

**Frontend enforcement today:** none. `AuthState.permissions: string[]` is populated from `/auth/me` but nothing reads it — no `*ngIf`/`@if` permission checks, no permission directive, no permission-aware guard exist anywhere in the repo. This must be built in Part 2A before any Settings screen can correctly hide/disable actions a user isn't allowed to perform (today, a user without `org:manage` would see Save/Create/Delete buttons that then 403 on click, with no 403-specific UI feedback per §4).

---

## 11. Layout / Topbar / Style Findings Summary

(Consolidates §6–§7 for quick reference.)

- Sidebar (`SideNavbarComponent`) is empty — no nav items to extend, must design from zero.
- Topbar (`TopNavbarComponent`) renders only a static profile-capsule text pill — no popover, no click affordance, no company selector. Both the company selector and the Appearance/profile popover are 100% new builds.
- Only 7 CSS variables exist, dashboard-scoped, consumed by 2 files. No Tailwind theme config. 3 files (`styles.css`, `main-layout.component.css`, `auth-layout.component.css`) contain literal hex colors; `auth-layout.component.css` has a stray bright-red full-page background that looks like leftover debug styling.
- 3 `shared/ui` components exist (button, card, loader), all hardcode Tailwind slate/gray/white classes instead of tokens. No input/select/modal/table components exist.
- No `tailwind.config.*` — Tailwind 4 CSS-first only, no `@theme` block defined.

---

## 12. Implementation Plan

No code in this section, per task scope. Order is fixed by real dependencies discovered above (department-head flow, permission split, list/pagination having zero precedent).

### Part 2A — Shared Frontend Foundation
- Design and implement a real CSS-variable/design-token set in `styles.css` (or a new `shared/styles/tokens.css`), generalized beyond the current `--dashboard-*` naming, covering surface/background/text/border/accent/focus-ring/badge colors — this is the single source of truth the Slack-like Appearance selector will swap between (multiple token sets = multiple presets, one active `data-theme`/class on `<html>` or `<body>` at a time).
- Retrofit `shared/ui/button`, `card`, `loader` to consume the new tokens instead of hardcoded `slate-*` Tailwind classes, so they don't need a second retrofit once Settings starts using them.
- Build the missing `shared/ui` primitives Settings needs: `input`, `select` (or a searchable combobox for country/timezone/parent-company pickers), `modal` (for Create Company / Delete Company confirmation), `table` (for Departments/Positions lists — first table in the app, so this defines the pagination-row/loading/empty/error convention for everyone after it).
- Design (frontend-local only) the theme-preset data model and a `ThemeStore` (`@ngrx/signals`, matching the `AuthStore` pattern) that holds the active preset and applies it (e.g. by toggling a `data-theme` attribute); persist the chosen preset locally (e.g. `localStorage`) since no backend persistence endpoint exists yet — leave an explicit seam (a single store method) for a future `PUT /api/v1/users/me/theme`-style call once the backend adds it.
- Design (not yet functional) the profile popover shell: a `shared/ui/popover` or `shared/ui/menu` primitive plus a `ProfileMenuComponent` that composes it, replacing/wrapping the current static `HomePageProfileCapsuleComponent` with a clickable trigger (`aria-haspopup="menu"`, `aria-expanded`) that opens a panel containing (at minimum) an "Appearance" section listing the presets from `ThemeStore`.
- Build the permission guard/directive gap identified in §2 and §10: a `permission.guard.ts` (`CanActivateFn` reading `AuthStore.permissions()`) for route-level gating, and a `*appPermission="'org:manage'"`-style structural directive (`shared/directives/permission.directive.ts`) for hiding/disabling individual buttons — both driven off the already-populated `AuthState.permissions`, no backend change needed.

### Part 2B — Company Selector + Selected Legal Entity State
- New `modules/organization/data-access/legal-entity-api.service.ts`: wraps `GET /api/v1/org/legal-entities?includeInactive=` (§9) — `org:read` gated at the UI level via the Part 2A guard/directive.
- New `modules/organization/state/legal-entity.store.ts` (`@ngrx/signals`, following the `AuthStore` pattern: flat `loading`/`error`, `withMethods` for `loadCompanies()`): holds the full company list plus a `selectedLegalEntityId` signal.
- Persistence: `selectedLegalEntityId` is **frontend-local only** for Part 1 (e.g. `localStorage`, keyed per authenticated user/tenant) — there is no backend concept of a "current selected company" (route-scoped `legalEntityId` is what every Department/Position endpoint actually requires, per §9's route shapes; nothing takes a body-level tenant/legalEntity id).
- Expose `selectedLegalEntityId` (and the resolved `LegalEntityListItemResponse` for display) as a public signal other modules (`organization/general-settings`, `organization/departments`, `organization/positions`) read to build their route params / API calls — this is the seam that makes every subsequent Part depend on Part 2B rather than each screen re-fetching the company list independently.
- Topbar integration: replace/augment the static profile capsule area with a company-selector dropdown (using the Part 2A `select`/combobox primitive) bound to `LegalEntityStore`; switching selection updates `selectedLegalEntityId` and should trigger downstream screens (if currently viewing Departments/Positions/General Settings) to reload for the new company.

### Part 2C — Legal Entity General Settings Page
- New `modules/organization/feature/general-settings/`: `GET /api/v1/org/legal-entities/{id}/general-settings` on load (id from `selectedLegalEntityId`), `PUT` same path to save — both gated `org:manage` (§10's non-obvious finding: this page needs the *stronger* permission, unlike the selector that loaded its company list under `org:read`).
- Field set and validation rules are fully specified in §9 (`UpdateLegalEntityGeneralSettingsRequest` + its `FluentValidation` rules) — map every rule 1:1 into Angular `ReactiveFormsModule` validators (required/maxLength/pattern/custom) so client-side errors match server messages instead of only surfacing them after a failed submit.
- Country: plain text/ISO-alpha-3 field bound to `countryCode` — **no country picker backed by a lookup table or endpoint**, since none exists (§9). If a dropdown UX is wanted, source the option list from a frontend-local static ISO-3166 alpha-3 list, not a fabricated `country_id`/`/countries` API.
- **No logo upload UI** — the upload endpoint doesn't exist (§9); leave the `logoFileId`/`logoFileId?` field in the response unused/read-only for Part 1, and treat logo entirely as out of scope until the backend exposes `PUT .../logo`.
- Save/error states: loading + error signals in a new `general-settings.store.ts`, using the `extractErrorMessage`-style ProblemDetails/FluentValidation-error parsing already proven in `AuthStore` (§8) — worth promoting that helper to `shared/utils/` now rather than re-writing it a fourth time across Parts 2C/2D/2F/2G.

### Part 2D — Create Company Modal
- `POST /api/v1/org/legal-entities` (§9), `org:manage`. Fields: `name`, `companyCode?`, `registrationNumber`, `countryCode`, `currencyCode`, `taxRegistrationNumber?`, `registeredBusinessAddress?`, `parentLegalEntityId?` — a strict subset of the General Settings edit form (no `timezone`/`financialYearStartMonth`/`standardWorkingDays`/etc. at create time; those only exist on Update).
- Parent-company dropdown: **supported** — populate from the already-loaded `LegalEntityStore` company list (§9 confirms `parentLegalEntityId` is a plain optional Guid, validated only as "not `Guid.Empty` if provided"; no circular-parent validation exists server-side, so don't imply the UI enforces a hierarchy the backend doesn't check beyond a plain FK).
- On success (`201`), the response body already **is** the full `LegalEntityGeneralSettingsResponse` for the new company (§9 — Create reuses that DTO) — no need for a second fetch; refresh `LegalEntityStore`'s list (re-run `loadCompanies()` or optimistically append) and select the new company as `selectedLegalEntityId`.
- Validation messages: identical rule set to General Settings' required-field subset (§9's `CreateLegalEntityCommandValidator`) — reuse the same shared error-parsing helper from Part 2C.

### Part 2E — Delete Company Confirmation
- `DELETE /api/v1/org/legal-entities/{id}` with body `{ confirmName }` (§9), `org:manage`.
- Exact-name confirmation: **case-sensitive** (`StringComparison.Ordinal`) match against the company's current `name` — the UI must not trim/lowercase before comparing client-side in a way that would pass what the server would reject, and must surface the server's own `"Company name confirmation does not match."` message on failure (no need to duplicate the match logic client-side beyond enabling/disabling the confirm button once the typed text equals the name).
- "Cannot delete last active company": server-enforced (`"Cannot delete or deactivate the last active company in the tenant."`, §9) — the modal should still pre-emptively disable/hide the delete action when `LegalEntityStore`'s list shows only one `isActive: true` company, to avoid a pointless round-trip, but must not skip handling the server error (the local count could be stale).
- On success (`204`), refresh `LegalEntityStore`'s list and clear `selectedLegalEntityId` if the deleted company was selected (fall back to another active company, or an explicit "no company selected" state if none remain — though the last-active-company rule means at least one will always remain).

### Part 2F — Departments
- New `modules/organization/data-access/department-api.service.ts` against the full endpoint set in §9 (list w/ `view=flat|tree`, get, create, update, archive, archive-check, restore, deprecated delete-alias). Route-scoped by `selectedLegalEntityId` from Part 2B.
- List: use the Part 2A `shared/ui/table` with the exact `DepartmentListPageResponse` shape (`items`, `page`, `pageSize`, `totalCount`, `totalPages`) — this is genuinely the first paginated list built in this codebase, so its loading/error/empty-state conventions (per the architecture doc's mandatory 4-state pattern, §7.4, which the code doesn't yet demonstrate anywhere) should be treated as the template Positions (2G) then reuses rather than reinventing.
- Create/Edit form: `name`, `code?`, `parentDepartmentId?` — **no `headPositionId` field on the Create form** (server rejects it with 409, §9's confirmed handler behavior). The Edit form *can* include `headPositionId`, but only once Part 2H (which needs Positions to exist first) is built — until then, Edit should omit that field too, or Part 2F and Part 2H should ship together if the Edit screen is meant to be complete on first release.
- Archive flow: call `archive-check` first (read-only, `org:read`) to render `DepartmentArchiveDependencyResponse.blockers`/`canArchive`/`message` before offering the actual `archive` action (`org:manage`), matching the two-step pattern the backend explicitly designed for (§9). Restore is a separate `org:manage` action with its own 409 case ("parent missing/inactive") to surface.
- Do not build against the `DELETE .../departments/{id}` alias — it's explicitly documented as deprecated in favor of `POST .../archive` (§9); only use it if there's a specific reason to target the older endpoint.

### Part 2G — Positions
- New `modules/organization/data-access/position-api.service.ts` against §9's full endpoint set (list, tree, get, create, update, archive-check, archive, restore). Same table/pagination convention as Part 2F, reusing whatever primitives that Part builds.
- List/table: `PositionResponse`/`PositionListItemResponse` already include `departmentName`/`reportsToPositionName` pre-joined (§9) — no need for the frontend to do its own department-name lookup per row.
- Create/Edit form: `departmentId` (required — positions always belong to a department, sourced from Part 2F's department list for the selected company), `name`, `code`, `positionType`, `maxOccupancy`, `reportsToPositionId?`.
- Archive-check: render `PositionArchiveBlockers` carefully — `activeOccupants`/`activeOccupantsCheckSupported: false` means the UI must show "occupancy not verifiable" rather than "0 occupants" (§9); `canArchive` is computed only from `headOfDepartments == 0 && activeChildPositions == 0`, deliberately excluding the unverifiable occupancy count.
- Relationship with Departments: Positions are always created/edited within the context of one department (via `departmentId`), and department deletion/archive-check logic is separate from position archive-check — the two lists are related by that FK but each screen calls its own archive-check independently.

### Part 2H — Department Head Position Selection
- Only reachable once both Part 2F (Departments) and Part 2G (Positions) exist and there is at least one active position in the target department.
- On the Department **Edit** screen only (never Create — server rejects it, §9): a head-position picker whose candidate list is the Positions list (Part 2G's data-access service) filtered to `departmentId === thisDepartment.id && isActive === true`.
- Submits via `PUT /api/v1/org/legal-entities/{legalEntityId}/departments/{departmentId}` with `headPositionId` set (§9) — the same Update endpoint as every other department-field edit, no separate "assign head" endpoint exists.

---

## 13. Risks and Blockers

- **Missing frontend layout pieces:** empty sidebar (no nav items/pattern), non-interactive profile capsule (no popover/menu primitive exists), no company selector UI — all of Part 2A/2B is net-new construction, not extension of an existing pattern.
- **Missing shared UI components:** no `input`, `select`, `modal`, or `table` component exists anywhere in `shared/ui/` — every Settings screen needs at least one of these, and none can be skipped or improvised without violating the "ui/ components don't call APIs, no duplicate buttons" architecture rule.
- **No pagination/list precedent:** Departments (2F) will be the first paginated, tabular, loading/error/empty-state screen ever built in this repo — there's real risk of establishing an inconsistent pattern here that Positions (2G) then has to either match or diverge from; worth a deliberate design pass in 2A/2F rather than improvising mid-build.
- **Hardcoded colors already in the codebase:** `auth-layout.component.css`'s `#e80c0c` background and the slate/gray Tailwind literals across `shared/ui` and the auth forms actively fight the "centralize theme" requirement (§7). They're out of this task's scope to fix, but if Settings' new components are built against a fresh token system while old components stay hardcoded, the app will visibly have two inconsistent styling systems side by side until someone retrofits the old ones.
- **No backend endpoint for logo upload:** `SetLegalEntityLogoRequest` DTO exists but its controller route is explicitly not wired up (§9) — don't plan logo upload UI for Part 1; only `DELETE .../logo` is real, and it's not independently useful without upload.
- **No country/lookup table:** `countryCode` is a free string with only a length constraint server-side — any country picker is a frontend-local list, not backend-verified; a user can submit an arbitrary 1–3 character string and the backend will accept it.
- **Auth/CSRF:** no functional gaps found for building Settings — the existing `csrfInterceptor`/`authInterceptor`/`errorInterceptor` chain already covers new mutating calls with no changes needed. The one real gap is **no `403`-specific handling** in `error.interceptor.ts`/`ErrorHandlerService` — since Settings introduces the first `org:manage`-vs-`org:read` split in the app, a user who can view but not edit will hit `403`s that today fall through to a generic/unknown-error path; Part 2A should decide whether to add explicit 403 handling or rely entirely on the permission guard/directive to prevent the request from ever being sent.
- **Theme system gaps:** no `tailwind.config.*`, no `@theme` block, only 7 narrowly-scoped CSS variables — the Slack-like Appearance selector described in the task requires designing a token system essentially from scratch (Part 2A), including deciding how many presets ship in Part 1 and how a preset switch propagates to already-rendered components (CSS variable swap on a root class/attribute is the natural fit given Tailwind 4's CSS-first setup, but this needs an explicit design decision, not just implementation).
- **Architecture-doc vs. actual-code mismatches worth flagging to the doc owner** (not blockers, but will mislead anyone who codes straight from the doc): §6.2's CSRF cookie/header names (doc: `XSRF-TOKEN`/`X-XSRF-TOKEN`; code: `onevo_csrf`+`onevo_legal_csrf`/`X-CSRF-Token`), §6.5's `role.guard.ts` example (doc: role-array-based; code's actual `AuthState` only has `permissions: string[]`, no `roles`), §7.3's token-refresh flow (doc: calls `/auth/refresh` on 401; code: no refresh call exists, just clear-session-and-redirect), and §5.1's `ApiResponse<T>`/`PaginatedResponse<T>` envelope (doc: wraps all responses; actual OrgStructure responses in §9 are unwrapped raw DTOs/pages).
- **Test/e2e gaps:** no `lint` script and no ESLint config exist — any new code has no linting gate. `ng test` uses Angular's built-in Vitest-backed runner with no custom config found; Playwright e2e (`e2e/`) exists but was not inspected for existing coverage relevant to Settings (out of this audit's file-reading scope — none of the existing spec files reference organization/settings, confirmed by the full `.ts` file listing in §2's investigation, which shows only auth/dashboard/shared spec files).

---

## Verification

**Command:** `git -C "C:\onevoNew\Hrms--Web-application---front-end---v1" status --short`
Before writing this report: clean (see §1). This report file itself is new and untracked — it will show as `?? FRONTEND_ORG_SETTINGS_AUDIT_AND_IMPLEMENTATION_PLAN.md` in `git status --short` after being written, since it was never `git add`ed as part of this task (no commit was requested or made).

**Command:** `git -C "C:\onevoNew\Hrms--Web-application---front-end---v1" diff --check`
This only inspects tracked, staged/unstaged changes to already-tracked files — it does not and cannot check an untracked new file's whitespace. No existing tracked file was modified by this task, so this command's (expected-empty) output does not certify anything about this new report; it's included here only because the task explicitly asked for it to be run and reported.

**No `npm install` was run. No test suite was run.** Every finding above is sourced from reading files directly (paths and line numbers cited throughout) — no endpoint, DTO, permission string, route, or component behavior in this report was inferred or invented without a corresponding source citation.

**Confirmation: no file other than this report was created, edited, deleted, formatted, renamed, or moved by this task**, in either the frontend repo, the backend repo, or anywhere else in `C:\onevoNew`.
