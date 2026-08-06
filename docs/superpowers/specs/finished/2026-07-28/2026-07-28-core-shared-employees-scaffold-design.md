# Design: Core + Shared + Employees Scaffold (with real auth backend)

**Date:** 2026-07-28
**Status:** Approved
**Base reference:** [ARCHITECTURE.md](../../../ARCHITECTURE.md) (sections 1-7, as saved)

## Scope

Scaffold `core/`, `shared/`, and `modules/employees/` from ARCHITECTURE.md §2 into `src/`,
as a working reference implementation. Other 10 business modules are explicitly **out of
scope** for this pass — `employees` is the template the rest will follow later.

Install and configure `@ngrx/signals` and Tailwind CSS, which the doc assumes but which
aren't present in this fresh Angular 21 scaffold.

## Deltas from ARCHITECTURE.md

The document was written before the real backend contract was known. These decisions
override what's written there:

### 1. Auth lives in `core/auth/`, not `modules/auth/`

The doc originally listed `modules/auth/` as an 11th lazy-loaded business module with its
own `feature/login/`, `feature/register/`, etc. That's wrong for this app: auth gates
every route, so it belongs in `core/auth/` alongside the service/guards, not as a
lazy-loaded feature module. `core/auth/` owns:
- `auth.service.ts` — API calls
- `auth.store.ts` — NgRx Signal Store for session state
- `feature/login/` — login page
- `feature/legal-consent/` — privacy/terms acceptance page
- `models/` — request/response DTOs, view models

### 2. Real login + legal consent gate flow

Backend: ASP.NET Core, `Microsoft.AspNetCore.Authentication.Cookies`. Base URL for dev:
`http://localhost:5139`, API prefix `/api/v1`.

```
LoginComponent
  → POST /api/v1/auth/login  { email, password }
  ← 200 {
       authenticated: false,
       user: { email },
       permissions: [], active_modules: [],
       must_change_password, mfa_required,
       legal_acceptance_required: true,
       pending_legal_documents: [{ document_type, version, title, effective_at, content_url }],
       expires_at: null,
       continue_url: "http://localhost:5139/api/v1/legal/acceptances/complete-login"
    }
    Set-Cookie: onevo_legal_csrf, onevo_legal_pending

  → route to LegalConsentComponent, render pending_legal_documents

  → POST /api/v1/legal/acceptances/complete-login
       header: X-CSRF-Token: <onevo_legal_csrf cookie value>
       body: { acceptances: [{ document_type, version, decision: "accepted" }, ...] }
  ← 200 {
       authenticated: true,
       user, permissions, active_modules,
       legal_acceptance_required: false,
       pending_legal_documents: null,
       expires_at: "<ISO timestamp>",
       continue_url: null
    }
    Set-Cookie: onevo_csrf, onevo_session (rotates from the legal_* pair)

  → AuthStore populated (authenticated=true), navigate to /dashboard
```

If `authenticated: true` comes back directly from `/auth/login` (no pending legal docs),
skip the consent step entirely.

`mfa_required`, `must_change_password`, and `active_modules` are stored on `AuthState` for
future use but **no branching UI/routing is built for them in this pass** — only the legal
consent gate is implemented end-to-end.

### 3. No manual token refresh

ASP.NET Core Cookie Authentication renews the session cookie server-side (sliding
expiration) on any authenticated request — there is no `/auth/refresh` endpoint to call.
This replaces ARCHITECTURE.md §7.3 entirely for this app:

- `error.interceptor.ts` on `401`: clear session state, navigate to
  `/login?returnTo=<current>`. No refresh-then-retry loop, no `isRefreshing` flag.
- `/auth/me` (session check on app bootstrap / guard) and `/auth/logout` are scaffolded
  with reasonable assumptions (cookie-based, same user envelope shape as login) since
  their real contracts haven't been provided yet. Both are marked with a comment flagging
  them as provisional, to be corrected once the real contracts are known.

### 4. CSRF: rotating cookie name, fixed header name

Double-submit pattern, but with this app's actual names (not the doc's
`XSRF-TOKEN`/`X-XSRF-TOKEN`):
- Header sent: always `X-CSRF-Token`.
- Cookie read: `onevo_csrf` if present, else `onevo_legal_csrf` (only one of the two
  exists at a time depending on auth stage — pre-consent vs. post-consent).
- Session itself lives in the `onevo_session` cookie, HttpOnly, never read from JS —
  `withCredentials: true` is enough for it to ride along.

### 5. Three-model pattern per module

Every module's `models/` folder splits into:
```
models/
  dto/
    <thing>-request.dto.ts    # what we send (matches backend request body)
    <thing>-response.dto.ts   # raw API response shape
  view/
    <thing>.view-model.ts     # UI-shaped, display-ready data used by components
```
The **state model** is not a separate file — it's the `type XState = {...}` defined
inline at the top of `state/<thing>.store.ts`, since it's only ever consumed by the store
itself.

Applies to both `core/auth/models/` and `modules/employees/models/`.

## Components to build

### `core/`
- `auth/data-access/auth-api.service.ts` — `login()`, `acceptLegalDocuments()`, `me()`, `logout()`
- `auth/state/auth.store.ts` — signal store: user, permissions, activeModules, authenticated, legalAcceptanceRequired, pendingLegalDocuments, loading, error
- `auth/feature/login/` — login form (email, password), calls `login()`, routes to legal-consent or dashboard based on response
- `auth/feature/legal-consent/` — renders `pending_legal_documents`, accept action calls `acceptLegalDocuments()`
- `auth/models/dto/` — `login-request.dto.ts`, `auth-response.dto.ts` (shared shape for login + legal-accept responses), `legal-document.dto.ts`, `legal-acceptance-request.dto.ts`
- `auth/models/view/` — `current-user.view-model.ts`
- `guards/auth.guard.ts` — uses `AuthStore`/`auth.me()`
- `interceptors/auth.interceptor.ts` — `withCredentials: true`
- `interceptors/csrf.interceptor.ts` — reads `onevo_csrf`/`onevo_legal_csrf`, sets `X-CSRF-Token`
- `interceptors/correlation.interceptor.ts` — per ARCHITECTURE.md §6.3, unchanged
- `interceptors/error.interceptor.ts` — retry+backoff for 5xx/network per §7.2, unchanged; `401` handling simplified per delta #3 above
- `services/error-handler.service.ts`, `notification.service.ts` — per §7.1 taxonomy
- `config/api-endpoints.ts`, `config/app.config.ts`
- `environments/environment.ts` — `apiUrl: 'http://localhost:5139/api/v1'`

### `shared/`
- `ui/button`, `ui/table`, `ui/modal`, `ui/card`, `ui/loader` — minimal working components, Tailwind-styled
- `models/api-response.model.ts`
- `utils/validation.helpers.ts`

### `modules/employees/`
Full reference module per ARCHITECTURE.md §2 layer breakdown (`feature/employee-list`,
`ui/employee-table`, `data-access/employee-api.service.ts`, `state/employee.store.ts`,
`models/dto/`, `models/view/`, `utils/employee.mapper.ts`), using the three-model
pattern. Employee API contract is **not yet provided** — CRUD against a placeholder
`/api/v1/employees` shape (matching ARCHITECTURE.md §5.1's `ApiResponse<T>` /
`PaginatedResponse<T>` envelope), clearly flagged as provisional.

All four required states (loading/error/empty/data) implemented in `employee-list`, per
ARCHITECTURE.md §7.4.

### Dependencies
- `npm install @ngrx/signals`
- Tailwind CSS v4 (PostCSS plugin, matches Angular 21's build pipeline) — `tailwind.config`
  not needed in v4's CSS-first config; `@import "tailwindcss";` in `styles.css`.

## Out of scope for this pass
- The other 10 business modules (dashboard, leave, attendance, payroll, recruitment,
  performance, reports, tenant-admin, settings) — folder structure only, no
  implementation, to be scaffolded module-by-module later using `employees` as the
  template.
- MFA and forced-password-change UI/routing.
- Service worker / PWA config (§3.3).
- WebSocket service (§5.4).
- Circuit breaker (§7.5) — noted in ARCHITECTURE.md but not wired into the interceptor
  chain yet.
- Accessibility, testing, build/deployment, coding standards, SEO, monitoring sections
  (§8-15) — not yet received from the source document.
