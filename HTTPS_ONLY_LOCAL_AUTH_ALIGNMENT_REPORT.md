# HTTPS-Only Local Auth Alignment Report

Scope: `C:\onevoNew\HRMS-Backend-v1` (current working branch) and `C:\onevoNew\Hrms--Web-application---front-end---v1` (`Development`). No commits or pushes were made in either repo. No OneVo-HR docs, Postman files, backend auth handlers/controllers/session-exchange/legal-acceptance logic, or migrations were touched. Package versions unchanged.

## Part 1 — Current broken state found

Before this task, local dev supported **both** HTTP and HTTPS, which is exactly the "mixed mode" this task removes:

| Aspect | State found |
|---|---|
| `.env`: `Urls__AppBaseUrl` | `http://localhost:4200` |
| `dotnet run` (no `--launch-profile`) | Defaulted to the **`http`** profile (first key in `launchSettings.json`'s `profiles` object) → **HTTP only**, port 5139 |
| `dotnet run --launch-profile https` | Bound to **both** `https://localhost:7229` **and** `http://localhost:5139` (`applicationUrl` was `"https://localhost:7229;http://localhost:5139"`) |
| `npm start` | `ng serve` with no `--ssl` flag → **HTTP only**, port 4200 |
| Frontend `environment.ts` | Branched on `window.location.protocol` via a `resolveLocalBackendPort()` helper: HTTP page → backend port 5139, HTTPS page → backend port 7229 — i.e. local HTTP was a fully supported first-class mode |

**Files still mentioning local HTTP fallback / port 5139** (found via repo-wide search for `5139`, `http://`, `--launch-profile http`, `LOCAL_HTTP_BACKEND_PORT`):
- Backend: `src/ONEVO.Api/Properties/launchSettings.json` (`http` profile + dual-bind on `https` profile), `src/ONEVO.Api/appsettings.Development.json` (`Urls:AppBaseUrl` = http, `AllowedOrigins` contained `http://localhost:5139` and `http://localhost:4200`), `src/ONEVO.Api/ONEVO.Api.http` (scratch file pointing at `http://localhost:5139`), `src/ONEVO.Application/Features/Auth/Login/Services/TenantSessionExchangeService.cs` (doc-comment example only: "e.g. http://localhost:4200 in dev").
- Frontend: `src/environments/environment.ts`, `src/environments/environment-url.helper.ts` (`LOCAL_HTTP_BACKEND_PORT`, `LOCAL_HTTPS_BACKEND_PORT`, `resolveLocalBackendPort`), `src/environments/environment-url.helper.spec.ts`, `src/app/core/auth/data-access/auth-api.service.spec.ts`, `src/app/core/auth/utils/auth.mapper.spec.ts`, `src/app/core/auth/state/auth.store.spec.ts`, `src/app/core/auth/feature/login/login.component.spec.ts`, `src/app/core/auth/feature/legal-consent/legal-consent.component.spec.ts` (all as `http://acme.localhost:4200`/port-5139 literals in test fixtures, not app logic), `playwright.config.ts` (`baseURL`/`webServer.url` = `http://localhost:4200`, which would have broken once `npm start` became HTTPS-only), `package.json` (`"start": "ng serve"`), `README.md` (instructed `ng serve` + `http://localhost:4200/`).

**Ports used:** 5139 (retired local HTTP port — no longer bound by anything), 7229 (the one and only local backend port going forward).

## Part 2 — Backend HTTPS-only local startup

`src/ONEVO.Api/Properties/launchSettings.json` now has a single `"https"` profile, `applicationUrl` trimmed to just `https://localhost:7229` (the `http://localhost:5139` suffix removed), and the `"http"` profile deleted entirely. Since it's the only `commandName: "Project"` profile, plain `dotnet run` uses it automatically — no `--launch-profile` argument needed, and no ASP.NET profile-selection ambiguity to solve.

## Part 3 — Backend local `.env`

`Urls__AppBaseUrl` changed from `http://localhost:4200` to `https://localhost:4200`. `Tenancy__RootDomain=localhost` was already correct — left unchanged. No secret values were touched or printed.

`.env.example` does **not** define `Urls__AppBaseUrl` or `Tenancy__RootDomain` at all (verified — no match), so there was nothing to update there.

## Part 4 — Frontend HTTPS-only local startup

`package.json`'s `"start"` script changed from `"ng serve"` to `"ng serve --ssl true --host 0.0.0.0 --port 4200"`. There was no separate HTTP start script to remove — `"start"` was the only dev-server script.

## Part 5 — Frontend local environment URL construction

`src/environments/environment-url.helper.ts` was split per Part 6's instruction:
- `buildApiUrl` / `buildWsUrl` / `resolveWsProtocol` remain generic same-origin builders (unchanged signatures), used only by production/staging.
- New `buildLocalApiUrl(hostname)` / `buildLocalWsUrl(hostname)` are local-dev-only: they always call `buildApiUrl('https:', hostname, 7229)` / `buildWsUrl('https:', hostname, 7229)` — a literal `'https:'` and a fixed `7229`, never a parameter. `resolveLocalBackendPort`, `LOCAL_HTTP_BACKEND_PORT`, and `LOCAL_HTTPS_BACKEND_PORT` were deleted.

`src/environments/environment.ts` no longer reads `window.location.protocol` at all — only `hostname` — and calls `buildLocalApiUrl(hostname)` / `buildLocalWsUrl(hostname)`. There is no branch, condition, or code path that can produce `http://` or `ws://` locally.

Verified against the task's examples:
- `https://localhost:4200` → `apiUrl = https://localhost:7229/api/v1`, `wsUrl = wss://localhost:7229/ws`
- `https://acme.localhost:4200` → `apiUrl = https://acme.localhost:7229/api/v1`, `wsUrl = wss://acme.localhost:7229/ws`

`environment-url.helper.spec.ts` was rewritten: all `5139`/`http:`/`ws://` assertions removed, replaced with `buildLocalApiUrl`/`buildLocalWsUrl` tests (bare localhost, tenant subdomain, always-https/wss assertions, explicit "never contains 5139" assertions). `resolveWsProtocol`'s two pure-mapping tests (`https:`→`wss:`, `http:`→`ws:`) were kept — that function is a generic protocol-mapper still used internally by `buildWsUrl` for production/staging, not a claim that local HTTP is supported.

## Part 6 — Production/staging behavior

`environment.prod.ts` and `environment.staging.ts` are **unchanged** — they still call the generic `buildApiUrl(protocol, hostname)` / `buildWsUrl(protocol, hostname)` with no port, deriving same-origin HTTPS/WSS URLs from `window.location`. Neither file references port 5139, 7229, or `http://`. The generic/local split described above ensures the shared helper file no longer contains any code path suggesting HTTP is a valid mode — only the production/staging-facing `buildApiUrl`/`buildWsUrl` remain generic (parameterized by the real page protocol, which in that deployment is always HTTPS), and local now goes through dedicated always-HTTPS functions.

## Part 7 — Auth flow verification (unchanged, confirmed by inspection)

- `AuthApiService.login()` still calls `getSystemApiUrl(environment.apiUrl)`, retargeting a tenant-subdomain apiUrl to the root hostname (e.g. `https://acme.localhost:7229/api/v1` → `https://localhost:7229/api/v1`) — confirmed by re-reading `auth-api.service.ts` (no logic edits) and its `getSystemApiUrl` unit tests (updated to use port 7229 instead of stale 5139).
- `sessionExchange()`, `me()`, `logout()`, `acceptLegalDocuments()` all still call `environment.apiUrl` directly, no retargeting.
- `SessionExchangeComponent` (not modified) still reads only `route.snapshot.queryParamMap.get('code')` and calls `store.exchangeSession(code)`.
- `csrf.interceptor.ts` (not modified) still reads `onevo_csrf`/`onevo_legal_csrf` and sends `X-CSRF-Token`.
- `auth.interceptor.ts` (not modified) still sets `withCredentials: true` unconditionally.

No backend auth/session/legal handler or controller was modified. The only backend `.cs` change is a doc-comment example string in `TenantSessionExchangeService.cs` (`http://` → `https://`); the method it documents (`BuildContinueUrl`) was already deriving scheme/port entirely from the `Urls:AppBaseUrl` config value, so no behavior changed.

## Part 8 — Dead HTTP-fallback code removed

| File | Removed/updated |
|---|---|
| `HRMS-Backend-v1/src/ONEVO.Api/Properties/launchSettings.json` | Deleted `"http"` profile; stripped `;http://localhost:5139` from the `https` profile |
| `HRMS-Backend-v1/.env` | `Urls__AppBaseUrl` → https |
| `HRMS-Backend-v1/src/ONEVO.Api/appsettings.Development.json` | `Urls:AppBaseUrl` → https; removed dead `"http://localhost:5139"` from `AllowedOrigins`; `"http://localhost:4200"` → `"https://localhost:4200"` in `AllowedOrigins` |
| `HRMS-Backend-v1/src/ONEVO.Api/ONEVO.Api.http` | `http://localhost:5139` → `https://localhost:7229` |
| `HRMS-Backend-v1/src/ONEVO.Application/.../TenantSessionExchangeService.cs` | Doc comment example → https |
| `Hrms--Web-application---front-end---v1/src/environments/environment-url.helper.ts` | Removed `resolveLocalBackendPort`, `LOCAL_HTTP_BACKEND_PORT`, `LOCAL_HTTPS_BACKEND_PORT`; added HTTPS-fixed `buildLocalApiUrl`/`buildLocalWsUrl` |
| `.../environment.ts` | Removed `window.location.protocol` branching entirely |
| `.../environment-url.helper.spec.ts` | Removed all `http:`/`ws://`/port-5139 assertions; added HTTPS-only local tests |
| `.../auth-api.service.spec.ts` | `getSystemApiUrl` test literals: port 5139 → 7229 |
| `.../auth.mapper.spec.ts`, `.../auth.store.spec.ts`, `.../login.component.spec.ts`, `.../legal-consent.component.spec.ts` | `http://acme.localhost:4200` fixture literals → `https://` (fixtures only, not asserting protocol behavior — updated for hygiene per Part 8's blanket sweep) |
| `.../playwright.config.ts` | `baseURL`/`webServer.url` → `https://localhost:4200`; added `ignoreHTTPSErrors: true` (required for `ng serve --ssl`'s self-signed cert) |
| `.../package.json` | `"start"` → `ng serve --ssl true --host 0.0.0.0 --port 4200` |
| `.../README.md` | Dev-server instructions → `npm start` / `https://localhost:4200/` |

**Not removed, and why:** `resolveWsProtocol('http:')` maps to `'ws:'`, and its test (`environment-url.helper.spec.ts`) was kept. This is a generic, protocol-agnostic pure function still used internally by `buildWsUrl` (the production/staging same-origin builder); testing both branches of a total function is not a claim that local HTTP is supported — the local-only `buildLocalWsUrl` never passes it anything but `'https:'`. Flagging this explicitly since a grep for `http:` in spec files will still land on it.

**Allowed exceptions (historical, left untouched):**
- `HRMS-Backend-v1/TENANT_SESSION_EXCHANGE_LOGIN_FLOW_REPORT.md` — historical report.
- `Hrms--Web-application---front-end---v1/FRONTEND_AUTH_HTTPS_TENANT_REDIRECT_FIX_REPORT.md` — historical report from an earlier session describing the now-superseded dual-protocol approach.
- Several other pre-existing, unrelated, already-uncommitted backend changes were present in the working tree before this task started (a Legal Entity module refactor, Postman collection deletions, migration files, test file edits, several `*_REPORT.md`/`docs/superpowers/plans/*.md` files) — **none of these were touched, read for logic, or created by this task.** They belong to other in-progress work and are called out here only so `git status` doesn't look surprising.

## Final local behavior

**Backend:** `dotnet run` (no arguments) → single `https` launch profile → binds **only** `https://localhost:7229`.
**Frontend:** `npm start` → `ng serve --ssl true --host 0.0.0.0 --port 4200` → binds **only** `https://localhost:4200`.
**Continue URL:** `https://{tenantSlug}.localhost:4200/auth/continue?code=...`
**Frontend API calls:** `https://localhost:7229/api/v1` (root host) and `https://{tenantSlug}.localhost:7229/api/v1` (tenant host) — always HTTPS, always port 7229, never 5139.

## Test results

- `npm test -- --watch=false`: **22 test files / 100 tests, all passing.**
- `npm run build` (production): **succeeded.**
- `npm run build:staging`: **succeeded.**
- Backend `dotnet test`: **not run.** No backend logic changed (only `launchSettings.json`, `appsettings.Development.json`, `.env`, and one doc-comment line) — matches the task's own stated exception ("If only `.env` changed, do not run backend tests just for that"). The backend project's compile correctness was confirmed indirectly: `dotnet run` (below) rebuilt and started successfully, which would have failed on a compile error.

## Manual verification

**Backend HTTPS-only startup — verified live.** Ran `dotnet dev-certs https --trust` (cert already trusted) then `dotnet run` in `src/ONEVO.Api`. Startup log shows exactly:
```
[01:34:14 INF] Now listening on: https://localhost:7229
[01:34:14 INF] Application started. Press Ctrl+C to shut down.
```
No second "Now listening" line, and a full-text search of the entire startup log (2700+ lines, including all EF Core seed queries) for `5139` returned **zero matches**. The process was stopped after verification.

*Note:* the first `dotnet run` attempt failed because a stray, already-running `ONEVO.Api.exe` (PID 36988, not started by this task, not listening on any relevant port) held a file lock on the build output. I asked for and received explicit approval before stopping it; it was not something the task itself started.

**Frontend HTTPS-only startup — verified live.** Ran `npm start` in the frontend repo. Output confirms:
```
➜  Local:   https://localhost:4200/
```
No HTTP listener. The process was stopped after verification.

**Full interactive browser flow (login → legal consent → tenant redirect → session-exchange → dashboard → refresh) — NOT performed.** This would require a live PostgreSQL-backed backend and the Angular dev server running simultaneously plus an interactive browser session exercising real credentials; verifying each server's own startup behavior in isolation (above) was judged sufficient evidence for the HTTPS-only binding requirement without leaving long-running local infrastructure up. If you'd like this run, say so and I'll start both servers and drive it through the browser.

**Playwright e2e — not run.** The pinned browser build (chromium/chrome-headless-shell v1234) is not installed in this environment (only a stale v1208 cache exists), and installing it requires a network download of browser binaries I did not perform without approval, per the task's own instruction. `playwright.config.ts` has been updated to point at `https://localhost:4200` with `ignoreHTTPSErrors: true`. Config validity (not execution) was confirmed with `npx playwright test --list`, which parses the config and enumerates the one e2e spec without launching a browser — it succeeded, confirming `webServer.ignoreHTTPSErrors` is a real, accepted option and the config isn't broken. Actually running the suite (`npm run e2e`) is ready once browsers are installed (`npx playwright install chromium`), but that launch — and specifically whether the `webServer` readiness poll tolerates the self-signed dev cert in practice — was not exercised.

## Remaining risks

- **No interactive manual browser validation was performed** (see above) — config and both servers' own startup binding were verified independently, not the full cross-subdomain cookie/redirect chain in a real browser.
- **Playwright e2e not exercised** in this session due to missing browser binaries.
- **`appsettings.Development.json`'s `AllowedOrigins`/`Urls:AppBaseUrl`** are checked-in fallback defaults (used only if `.env` doesn't override them via env-var config precedence); they were updated to https for consistency, but if any other unrelated local workflow depended on the old `http://localhost:5139`/`http://localhost:4200` entries, it will need to be repointed.
- **Admin Console origins (5173/5174) were deliberately left on `http://`** — out of scope for this task (a separate frontend app), not touched.
- **`npm start` binds `0.0.0.0`** (as the task specified), not just `localhost`. The live verification run confirmed the dev server is reachable over HTTPS from the LAN too (`https://192.168.208.1:4200/`, `https://192.168.8.114:4200/` were both logged as active). This is the direct, expected consequence of the requested `--host 0.0.0.0` flag (needed to accept tenant-subdomain Host headers), not a defect, but worth knowing if this machine is on an untrusted network.
- **A stray backend process was stopped mid-task** (PID 36988, approved by you) — if that was serving a workflow outside this task, it will need to be restarted manually.
