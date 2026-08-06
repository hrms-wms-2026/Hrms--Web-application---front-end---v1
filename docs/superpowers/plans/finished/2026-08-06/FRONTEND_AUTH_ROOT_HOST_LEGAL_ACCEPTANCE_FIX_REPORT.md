# Frontend Auth Root-Host Legal-Acceptance Fix Report

## Root cause

`AuthApiService.acceptLegalDocuments()` posted directly to `environment.apiUrl`, which is
same-origin-derived from `window.location.hostname` (see `environment.ts` /
`environment-url.helper.ts`). `login()` already retargeted to the root/system host via
`getSystemApiUrl(environment.apiUrl)`, but `acceptLegalDocuments()` did not.

Sequence that produced the bug:

1. Browser is on `acme.localhost:4200/auth/login` (a tenant host).
2. `login()` correctly posts to the root backend (`https://localhost:7229`) via
   `getSystemApiUrl`. The backend issues the `onevo_legal_pending` / `onevo_legal_csrf` cookies
   scoped to `localhost`.
3. `LoginComponent.submit()` calls `router.navigate(['/auth/legal-consent'])` — an in-SPA
   navigation that stays on `acme.localhost:4200`.
4. `LegalConsentComponent.accept()` → `acceptLegalDocuments()` posts to
   `environment.apiUrl`, which on this page is `https://acme.localhost:7229` (unretargeted).
5. The tenant backend host never received the `onevo_legal_pending` cookie set on `localhost`,
   so the request 401s with "Legal acceptance session is missing or expired."

Nothing about `sessionExchange()` was wrong — it is correctly tenant-host-only by design and was
left untouched.

## Files changed

| File | Change |
|---|---|
| `src/app/core/auth/utils/tenant-redirect.ts` | Added `isTenantHostname(hostname)` (pure predicate) and `buildRootUrl(path)` (frontend-navigation counterpart to `getSystemApiUrl`, reuses `getRootHostname`). |
| `src/app/core/auth/utils/tenant-redirect.spec.ts` | Tests for both new helpers. |
| `src/app/core/auth/data-access/auth-api.service.ts` | `acceptLegalDocuments()` now posts to `getSystemApiUrl(environment.apiUrl)`, matching `login()`. `sessionExchange()`, `me()`, `logout()` unchanged. |
| `src/app/core/auth/data-access/auth-api.service.tenant-host.spec.ts` **(new)** | Simulates the app running on `acme.localhost` by mutating the shared `environment.apiUrl` object (restored in `afterEach`, restore runs *before* `httpMock.verify()` so a verify failure can't leave the mutation in place for later spec files). Proves `login()`/`acceptLegalDocuments()` retarget to the root host while `sessionExchange()`/`me()`/`logout()` stay on the tenant host. `vi.mock('@environments/environment', …)` was tried first and does **not** work under Angular's esbuild-bundled Vitest runner (confirmed empirically — the mocked value was never observed by the service); the direct-mutation approach was used instead since `environment` is `as const` only at the TypeScript level, not `Object.freeze`d at runtime. |
| `src/app/core/auth/feature/login/login.component.ts` | Added `ngOnInit` that hard-redirects (`window.location.href`) to `buildRootUrl('/auth/login')` when `isTenantHostname(window.location.hostname)`. `submit()` also short-circuits if still on a tenant host. |
| `src/app/core/auth/feature/login/login.component.spec.ts` | Tests: tenant-host redirect fires with the correct root URL, root-host does not redirect, `submit()` doesn't call `login()` from a tenant host. |
| `src/app/core/auth/feature/legal-consent/legal-consent.component.ts` | Added `ngOnInit` that redirects to `buildRootUrl('/auth/legal-consent')` only when `store.legalAcceptanceRequired()` is true **and** `isTenantHostname(...)`. |
| `src/app/core/auth/feature/legal-consent/legal-consent.component.spec.ts` | Tests: redirects when both conditions hold, does not redirect when acceptance isn't required, does not redirect on the root host. Existing tests updated to stub `legalAcceptanceRequired` now that `ngOnInit` reads it. |
| `src/app/core/auth/feature/session-exchange/session-exchange.component.spec.ts` | Added an explicit assertion that the failed/expired-exchange message does **not** contain "Legal acceptance session" — this was already true in the existing code/message wiring, now it's a locked-in regression test. |

No changes were needed to `csrf.interceptor.ts` (host-agnostic — reads `document.cookie`
regardless of request target) or `auth.guard.ts` (its `router.navigate(['/auth/login'])` now
naturally lands on `LoginComponent`, whose new `ngOnInit` handles the tenant-host bounce).

## Route/host behavior before vs after

| Scenario | Before | After |
|---|---|---|
| Browser opens `acme.localhost:4200/auth/login` | Login form rendered on tenant host; credentials would still work (login() retargeted) but any legal-consent gate would break. | `ngOnInit` immediately hard-redirects to `https://localhost:4200/auth/login`; form is not shown/submittable on the tenant host. |
| Browser opens `localhost:4200/auth/login` | Rendered normally. | Unchanged — no redirect. |
| Login succeeds, legal acceptance required | In-SPA nav to `/auth/legal-consent`, staying on whatever host login ran on (root, given the fix above). `acceptLegalDocuments()` posted to `environment.apiUrl` — **tenant host if reached from one**, causing the 401. | `acceptLegalDocuments()` always posts to `getSystemApiUrl(environment.apiUrl)` (root host), matching where the `onevo_legal_pending`/`onevo_legal_csrf` cookies were set. |
| `/auth/legal-consent` somehow reached on a tenant host with `legalAcceptanceRequired()` true | No guard; would 401 as above. | `ngOnInit` hard-redirects to the root host's `/auth/legal-consent`. This is a defensive backstop — see Remaining Risks. |
| `sessionExchange()` (tenant host `/auth/continue?code=...`) | Posts to `environment.apiUrl` on the current (tenant) host. | Unchanged — still posts to the current tenant host, per requirement. |

## Tests run

`npm test -- --watch=false` (full suite): **260 tests passed, 54 files passed**, no failures.

Specifically covering this fix (all passing):
- `tenant-redirect.spec.ts` — `isTenantHostname` (tenant `.localhost`/production subdomain → true, root/IPv4 → false), `buildRootUrl`.
- `auth-api.service.tenant-host.spec.ts` (new) — `login()`/`acceptLegalDocuments()` retarget to root; `sessionExchange()`/`me()`/`logout()` stay on tenant host; `acceptLegalDocuments()` body is exactly `{ acceptances }` (no `tenantId`/`userId`).
- `login.component.spec.ts` — tenant-host redirect fires with correct URL; root-host does not redirect; `submit()` is a no-op on a tenant host.
- `legal-consent.component.spec.ts` — tenant-host + acceptance-required redirects; no redirect when acceptance not required or already on root host.
- `session-exchange.component.spec.ts` — failed/expired exchange shows the generic invalid-link message and explicitly does **not** contain "Legal acceptance session".
- `csrf.interceptor.spec.ts` (pre-existing, unmodified) — already asserts `X-CSRF-Token: <onevo_legal_csrf value>` on a POST to the exact `/api/v1/legal/acceptances/complete-login` path, so CSRF behavior for this endpoint was already covered and is unchanged.

`npm run build` — succeeded (production configuration).
`npm run build:staging` — succeeded (staging configuration).
`git diff --check` (run from inside this nested repo) — exit 0; only pre-existing LF→CRLF
warnings on unrelated files untouched by this change, no new whitespace errors.

Requirement 5 (no reuse of one-time `continue_url` codes) — verified by inspection:
`grep -rn "localStorage|sessionStorage" src/app/core/auth src/app/core/interceptors src/app/core/guards`
returned no matches. `continueUrl`/exchange codes exist only in the in-memory `AuthStore` signal
state and the URL itself; nothing persists them across page loads, so a stale code cannot be
silently replayed by the frontend.

## Manual verification

**Not run.** The 9-step manual flow requires a live backend on `https://localhost:7229` and
browser-trusted TLS certs for `acme.localhost`/`dapi.localhost`; `.certs/` in this repo currently
only contains `localhost-cert.pem`/`localhost-key.pem` (no tenant-subdomain SAN certs verified
present), and the task explicitly excluded touching the backend. Running only the frontend would
let steps 1–3 (tenant→root login redirect) be checked but not steps 4–9 (login, legal acceptance,
continue_url handoff, session exchange, dashboard load), so a partial browser session was skipped
rather than reported as a false partial pass. The original 9-step manual checklist should be run
by whoever has the full stack (backend + trusted certs) available:

1. Clear cookies for `localhost`, `acme.localhost`, `dapi.localhost`.
2. Open `https://acme.localhost:4200/auth/login`.
3. Confirm it redirects to `https://localhost:4200/auth/login`.
4. Login as an account requiring legal acceptance.
5. Accept legal documents.
6. Confirm frontend follows backend `continue_url` to tenant host.
7. Confirm session exchange succeeds.
8. Confirm `/dashboard` loads.
9. Repeat with a user from a different tenant.

## Remaining risks

- **The legal-consent tenant→root guard is a backstop, not the primary fix, and is largely
  unreachable in practice.** It only fires while `store.legalAcceptanceRequired()` is still true
  *and* the browser is on a tenant host — but a cross-host hard navigation (the `LoginComponent`
  fix) resets to a fresh page load, and a fresh load of `/auth/legal-consent` with no prior
  `login()` call has `legalAcceptanceRequired()` at its `initialState` default (`false`), so the
  guard won't fire. The load-bearing fix is `LoginComponent` never submitting credentials from a
  tenant host in the first place. This was a deliberate choice — no state persistence was added
  to make the legal-consent guard "recoverable" after a hard navigation, since that's beyond what
  was asked.
- **`csrf.interceptor.ts`'s cookie preference order is unchanged and out of scope.**
  `CSRF_COOKIE_NAMES = ['onevo_csrf', 'onevo_legal_csrf']` prefers `onevo_csrf` if both are
  present. A stale `onevo_csrf` left over on `localhost` from a prior full session would cause the
  legal-acceptance POST to send the wrong CSRF token instead of the pending-consent one — this is
  exactly why manual step 1 says to clear cookies first. Not reordered/fixed here, since that would
  be a CSRF-handling behavior change beyond this bug's scope.
- **`authGuard`'s `router.navigate(['/auth/login'])` and the `'**'` wildcard route now trigger a
  full page reload when hit on a tenant host** (e.g., an expired tenant-dashboard session), because
  `LoginComponent.ngOnInit` hard-redirects via `window.location.href` rather than staying in-SPA.
  This is correct per requirement 1 but is a UX behavior change worth calling out. Same applies to
  `SessionExchangeComponent.backToLogin()`. No redirect loop is possible: `isTenantHostname` is
  false once on the root host.
- **MFA and force-password-change gates are not yet implemented in the frontend** beyond the
  `mfa_required`/`must_change_password` fields already present on `AuthResponseDto`. This fix
  doesn't add UI for them; it only ensures that whichever gate the base-login flow reaches next
  (currently just legal-consent) stays on the root host, so wiring those gates in later will
  inherit the same root-host guarantee via the same pattern.
- Manual end-to-end verification was not performed (see above) — the unit-test coverage is strong
  (host retargeting is exercised at both the pure-function and HTTP-request level, not just
  asserted by inspection) but does not replace a real run against a live backend with valid certs.
