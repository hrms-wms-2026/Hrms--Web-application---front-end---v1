# Frontend Auth HTTPS + Tenant-Subdomain Redirect Fix Report

Scope: `Hrms--Web-application---front-end---v1` only, branch `Development`. No backend, OneVo-HR docs, Postman, package version, or unrelated UI changes were made.

## 1. Baseline finding

Before making any changes, all files listed in the task were read and compared against the required auth flow. Most of the flow was **already implemented correctly** in this branch:

- `tenant-redirect.ts` (`getRootHostname`, `buildTenantUrl`) already existed and was already fully unit-tested.
- `AuthApiService.login()` already retargeted to the root host via a local `getSystemApiUrl()` helper; `sessionExchange()` / `me()` / `logout()` / `acceptLegalDocuments()` already stayed on `environment.apiUrl` (the current host) without retargeting.
- `SessionExchangeComponent` already read only the `code` query param via `ActivatedRoute`, passed it straight to `AuthStore.exchangeSession(code)`, navigated to `/dashboard` on success, and showed a failed state with a back-to-login action on failure.
- `LoginComponent` / `LegalConsentComponent` already used `window.location.href = continueUrl` for the base→tenant handoff and never treated `redirectRequired` as an authenticated dashboard session.
- `auth.interceptor.ts` already set `withCredentials: true` unconditionally.
- `csrf.interceptor.ts` already skipped safe methods, read `onevo_csrf`/`onevo_legal_csrf` from cookies, sent `X-CSRF-Token`, never touched the body, and sent no header when neither cookie existed.
- `app.routes.ts` already wired `/auth/legal-consent` and `/auth/continue` to the right lazy components.
- `e2e/auth-happy-path.spec.ts` already covered the full login → legal-consent → tenant redirect → session-exchange → dashboard path with mocked API responses.

The one real gap was in the **environment files**: HTTPS was not being respected.

## 2. Files read

`environment.ts`, `environment.prod.ts`, `environment.staging.ts`, `runtime-config.model.ts`, `auth-api.service.ts` (+ spec), `tenant-redirect.ts` (+ spec), `login.component.ts` (+ spec), `legal-consent.component.ts` (+ spec), `session-exchange.component.ts` (+ spec), `auth.store.ts`, `auth.interceptor.ts` (+ spec), `csrf.interceptor.ts` (+ spec), `api-endpoints.ts`, `app.routes.ts`, `playwright.config.ts`, `e2e/auth-happy-path.spec.ts`, `package.json`, `angular.json`, `tsconfig.spec.json`.

## 3. Files changed

- **`src/environments/environment-url.helper.ts`** (new) — pure, testable helpers: `resolveWsProtocol`, `buildApiUrl`, `buildWsUrl`. Never hardcodes `http://`/`ws://`; derives everything from the page's own `protocol`/`hostname`.
- **`src/environments/environment-url.helper.spec.ts`** (new) — unit tests for the helper (https/http localhost, https tenant subdomain, wss/ws mapping, no-port variant).
- **`src/environments/environment.ts`** — now builds `apiUrl`/`wsUrl` via the helper using `window.location.protocol` + `window.location.hostname`, instead of hardcoding `http://`/`ws://`.
- **`src/environments/environment.prod.ts`** — replaced the fixed `https://api.onevo.example` host with the same-origin strategy (`window.location.protocol`/`hostname`, no fixed port), with an inline comment explaining why: `HostTenantResolutionMiddleware` resolves tenant context from the request `Host` header, so a fixed API domain would never see `{tenantSlug}.onevo.com` and would break tenant resolution in production.
- **`src/environments/environment.staging.ts`** — same same-origin fix, replacing `https://staging-api.onevo.example`.
- **`src/app/core/auth/data-access/auth-api.service.ts`** — exported the existing (previously private) `getSystemApiUrl` helper so it can be unit-tested directly.
- **`src/app/core/auth/data-access/auth-api.service.spec.ts`** — added a `getSystemApiUrl` describe block asserting a tenant-subdomain `apiUrl` (dev and prod-shaped) retargets to the root host, and that an already-root `apiUrl` is left unchanged.
- **`src/app/core/interceptors/csrf.interceptor.spec.ts`** — added one assertion (`expect(req.request.body).toEqual({})`) to the existing `onevo_csrf` POST test, so "no `csrf_token` in body" is an explicit assertion rather than something only true by construction.

No changes were needed to `AuthApiService`'s public methods, `AuthStore`, the components, the interceptors, `api-endpoints.ts`, or `app.routes.ts` — they already matched the required contract.

## 4. Environment URL behavior: before/after

| Page URL | `apiUrl` before | `apiUrl` after |
|---|---|---|
| `https://localhost:4200` (dev) | `http://localhost:5139/api/v1` (hardcoded http) | `https://localhost:5139/api/v1` |
| `https://acme.localhost:4200` (dev) | `http://acme.localhost:5139/api/v1` (hardcoded http) | `https://acme.localhost:5139/api/v1` |
| `http://localhost:4200` (dev) | `http://localhost:5139/api/v1` | `http://localhost:5139/api/v1` (still not hardcoded — derived from page protocol) |
| `wsUrl` (dev, any host) | always `ws://...` | `wss://` when page is `https:`, `ws://` when page is `http:` |
| `https://onevo.com` (prod) | `https://api.onevo.example/api/v1` (fixed, wrong host for tenant resolution) | `https://onevo.com/api/v1` |
| `https://acme.onevo.com` (prod) | `https://api.onevo.example/api/v1` (fixed — would resolve as System context, not tenant `acme`) | `https://acme.onevo.com/api/v1` |
| staging | fixed `https://staging-api.onevo.example` | same-origin, mirrors production strategy |

## 5. Confirmations

- **Login retargets to root host**: confirmed. `AuthApiService.login()` calls `getSystemApiUrl(environment.apiUrl)`, which rewrites a tenant-subdomain hostname (e.g. `acme.localhost`) back to the root (`localhost`) via `getRootHostname`. Directly unit-tested in `auth-api.service.spec.ts`.
- **Session exchange stays on the tenant host**: confirmed by inspection — `AuthApiService.sessionExchange()`, `me()`, `logout()`, and `acceptLegalDocuments()` all call `environment.apiUrl` directly with no `getSystemApiUrl()` wrapping, unlike `login()`. Caveat on the test evidence: the existing `auth-api.service.spec.ts` asserts these requests hit `environment.apiUrl`, but under jsdom's default hostname (`localhost`) that value is already root, so `getSystemApiUrl(apiUrl) === apiUrl` there — the spec would pass identically whether or not retargeting happened. It proves the URL, not the absence of retargeting. The asymmetry itself is verified by code inspection and by the new `getSystemApiUrl` unit tests in the same file, which directly show a tenant-subdomain input is rewritten while a root input is not.
- **HTTPS is not hardcoded as HTTP**: confirmed. `environment.ts`/`.prod.ts`/`.staging.ts` no longer contain any literal `http://` or `ws://` string; protocol is derived from `window.location.protocol` via `environment-url.helper.ts`, verified by `environment-url.helper.spec.ts`.

## 6. Test commands and results

- `npm install` — required first; `node_modules` was absent in this checkout. Succeeded (488 packages).
- `npm test -- --watch=false` (`ng test --watch=false`, Vitest via `@angular/build:unit-test`) — **22 test files / 96 tests, all passing.**
- `npm run build` (production config) — **succeeded**, output in `dist/Customer-web-application`.
- `npm run build:staging` — **succeeded**.
- `npm run e2e` (Playwright, `e2e/auth-happy-path.spec.ts`) — **not run successfully**: Playwright's pinned browser build (chromium/chrome-headless-shell v1234) is not installed in this environment (only an older v1208 cache exists), and installing it requires a network download of browser binaries that I did not perform without asking first. The exact failure:
  ```
  Error: browserType.launch: Executable doesn't exist at
  C:\Users\User\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe
  ```
  Run `npx playwright install` (or `npx playwright install chromium`) and re-run `npm run e2e` to execute it. The spec itself was not modified and needed no changes — it already exercises the flow described in this task's manual verification steps 3–9, with the four backend calls mocked.

## 7. Manual verification status

**Not run.** Per the task instructions ("do not fake verification"), this was not attempted because:
- No live backend was started or available in this session (the task explicitly scopes work to the frontend repo only).
- No HTTPS dev certificate/dev server was started (`ng serve` was not launched in this session — only `ng build` and `ng test`).

If a backend with HTTPS and a matching frontend dev cert are available, the 10-step manual flow in the task description (login at `https://localhost:<port>/auth/login` through `/auth/me` restoring the session on refresh) has not been executed against real infrastructure and should be run before sign-off.

## 8. Remaining risks

- **Manual/E2E flow unverified against a real backend.** Unit tests and builds pass, but nothing in this session exercised the actual network path against a live HTTPS backend.
- **Production/staging same-origin assumption.** The same-origin `apiUrl`/`wsUrl` strategy assumes the production/staging reverse proxy or edge terminates TLS and forwards `/api` and `/ws` paths on the *same* hostname through to the backend without rewriting `Host`. If a separate API domain is ever reintroduced, the backend must resolve tenant context from a forwarded header (e.g. `X-Forwarded-Host`) instead — the comments in `environment.prod.ts`/`environment.staging.ts` call this out explicitly.
- **`wsUrl` is unconsumed and unverified.** `grep -rn "wsUrl" src/` shows it is only defined in the three environment files and the `RuntimeConfig` type — nothing in `src/app` currently reads `environment.wsUrl` to open a WebSocket connection. So the prod/staging portless `wss://<hostname>/ws` shape (matching the pre-existing `wss://api.onevo.example/ws`, also portless — no regression there) is unexercised by any code path today. Once a consumer is added, its actual routing (same-origin `/ws` upgrade proxied to the backend on 443) needs to be verified against the real edge/proxy config before relying on it.
- **Playwright browser binaries out of date** in this environment (cached v1208 vs. required v1234); e2e coverage for this exact change has not been executed here.
- **CSRF cookie disambiguation.** `csrf.interceptor.ts` (unchanged in this task) picks whichever of `onevo_csrf`/`onevo_legal_csrf` exists first, checking `onevo_csrf` before `onevo_legal_csrf`. This is correct under the current flow (only one cookie is present at a time — `onevo_legal_csrf` on the root host pre-exchange, `onevo_csrf` on the tenant host post-exchange) but would silently prefer the wrong token if both cookies were ever present simultaneously on the same host.
