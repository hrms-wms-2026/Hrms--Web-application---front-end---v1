# One Error Handling Standard Implementation Plan (Improvements task 20)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The same failure shows the same message on any screen, a server-error toast carries a correlation id that support can find in the backend logs, field errors from a 400 land next to their fields, and the user sees when the browser is offline.

**Architecture:** `toApiError(err)` (in `core/errors/api-error.ts`) turns any HTTP error into one `ApiError` (status, kind, code, safe message, field errors, correlation id, retry-after). It reuses `toSafeErrorMessage`, so the 69 existing callers keep their messages. The error interceptor records each request's `X-Correlation-ID` against its error, and `ErrorHandlerService.handle` uses the `ApiError` for its toasts. The thrown value stays an `HttpErrorResponse`. A `NetworkStatusService` drives an offline banner, and a global `ErrorHandler` reports unexpected client errors through `LoggerService`.

**Tech Stack:** Angular 21, RxJS, Vitest.

**Source task:** `docs/Improvements/person-4-api-layer-and-cleanup/task-20 One error handling standard.md`.

**Backend status:** backend task 24 (one problem body with a stable `code`) has **not** landed. This plan works with the bodies the backend sends today:
- `ExceptionHandlerMiddleware`: `{type, title, status, detail, instance, errors, correlationId}`
- auth/CSRF/rate-limit middlewares: `{type, title, status, detail}`, without `correlationId`
- controller `Problem(...)`: `{type, title, status, detail, traceId}`
- tray: `{type, title, status, code}`
- tenant enforcement: `{status, detail}`

`code` is read whenever it is present, so the frontend picks it up as soon as backend 24 adds it.

**Base:** stacked on `chore/shared-validation-forms` (#182), which contains #180 (test gates) and #179 (shared validators, needed for server field errors). Merge order: #180 → #179 → #182 → this PR.

---

## Decisions

1. **The thrown value does not change.** Stores and specs check `instanceof HttpErrorResponse` and read `.status`. Callers that need structure call `toApiError(err)`.
2. **Correlation id comes from the request.** The correlation interceptor sets `X-Correlation-ID` on every request, and the error interceptor (which runs after it) records it in a `WeakMap` keyed by the error. The response header is a fallback only. In dev the API is cross-origin and CORS does not expose custom headers.
3. **`Retry-After`** is read from the response when it is visible (same-origin in production; CORS hides it in dev). When it is unknown, the message has no number.
4. **Per status:**
   - 400/422 with field errors: show them next to the fields when the form maps them. Otherwise show the first one as the message (today's behaviour).
   - 403: keep the global toast. Screens that show their own access state opt out with `SILENT_HTTP_ERRORS`.
   - 404: inline, as today.
   - 409/422: the backend message, as today.
   - 429: "Too many requests. Please wait N seconds and try again." when N is known.
   - 5xx and network: one toast with `Reference: <correlation id>`.
   - 0 while the browser is offline: no toast, because the banner already says it.
   - 401, CSRF, tenant mismatch and 428 stay exactly as they are.
5. **Field errors.** The keys are PascalCase and can be nested (`Addresses[0].AddressType`). The top-level segment, with its first letter lowercased, is the control name. A message that looks technical (`isMachineValue`) is dropped. A key with no control becomes a form-level message.
6. **Client errors** go to `LoggerService`, which has a pluggable `LOG_SINK`. Backend task 17 has not chosen a log target, so no URL is invented. Each report gets a client-side id.
7. **Out of scope:** migrating the 69 `toSafeErrorMessage` callers and the 141 store `error` fields. They are listed in the task file.

## File structure

- Modify `src/app/shared/models/problem-details.model.ts`: every field optional, plus `errors`, `code` and `instance`.
- Create `src/app/core/errors/api-error.ts` and its spec: `ApiError`, `toApiError`, `rememberCorrelationId`.
- Modify `src/app/core/interceptors/error.interceptor.ts`: record the correlation id.
- Modify `src/app/core/services/error-handler.service.ts`: toasts built from `ApiError` (5xx reference, 429 wait time, offline skip).
- Create `src/app/shared/utils/validators/server-errors.ts` and its spec: `applyServerFieldErrors`. Add a `server` message key.
- Create `src/app/core/network/network-status.service.ts`, `src/app/shared/ui/offline-banner/offline-banner.component.ts` and their specs. Put the banner in `app.html`.
- Create `src/app/core/errors/global-error-handler.ts` and its spec. Add `LOG_SINK` to `logger.service.ts`.
- Proof form: general settings. The store keeps `saveApiError`, and the component applies field errors.
- Docs: ARCHITECTURE §7.1/§7.4, the task 20 status, SUMMARY rows.

### Task 1: characterization tests for today's messages

- [ ] Add specs to `error-handler.service.spec.ts` that pin the current `toSafeErrorMessage` output for: a problem body with `detail`, a validation body with `errors`, `{message}`, a plain string, 500 with a fallback, status 0, and an unknown status. They must pass before any change, and keep passing after.

### Task 2: `ApiError` and `toApiError`

- [ ] Write failing specs for:
  - `kind` per status (400/422 `validation`, 401 `unauthorized`, 403 `forbidden`, 404 `not-found`, 409 `conflict`, 429 `rate-limited`, 5xx `server`, 0 `network`)
  - `message` equal to `toSafeErrorMessage(err)`
  - `code` from the body
  - `fieldErrors` from `errors`, with technical messages dropped
  - `correlationId` in this order: body, then the remembered request id, then the response header
  - `retryAfterSeconds` from the `Retry-After` header (seconds, or null)
  - a non-HTTP error becomes `kind: 'other'`
- [ ] Implement `core/errors/api-error.ts` and extend `ProblemDetails`. Run the spec until it passes, then commit.

### Task 3: interceptor records the correlation id

- [ ] Failing spec in `error.interceptor.spec.ts`: a 500 for a request with `X-Correlation-ID: abc` gives `toApiError(err).correlationId === 'abc'`, and the thrown value is the same `HttpErrorResponse`.
- [ ] Implement: in `catchError`, call `rememberCorrelationId(error, req.headers.get('X-Correlation-ID'))` before anything else. Commit.

### Task 4: toasts from `ApiError`

- [ ] Failing specs on `ErrorHandlerService.handle`:
  - 500 toasts `"<message> Reference: abc"`
  - 429 with `Retry-After: 30` toasts "Too many requests. Please wait 30 seconds and try again."
  - 429 without the header keeps today's text
  - status 0 while `NetworkStatusService.online()` is false toasts nothing
  - 403 still toasts
- [ ] Implement it, then commit.

### Task 5: server field errors

- [ ] Failing specs on `applyServerFieldErrors(form, apiError)`:
  - `{ Name: ['Company name must be 200 characters or fewer.'] }` sets `name` errors `{ server: { message } }`, marks it touched, and returns null
  - a nested key `Addresses[0].AddressType` maps to `addresses`
  - an unknown key's message is returned as the form-level message
  - `validationMessage({ server: { message: 'x' } }, 'Name')` gives `'x'`
- [ ] Implement it, then commit.

### Task 6: proof form (general settings)

- [ ] Failing spec: when the store's save fails with a 400 whose `errors` has `CompanyCode`, the company code field shows that message.
- [ ] The store keeps `saveApiError: ApiError | null`. The component calls `applyServerFieldErrors(this.form, apiError)` and toasts the form-level message, or `saveError` when there is none. Commit.

### Task 7: offline banner

- [ ] Failing specs:
  - `NetworkStatusService.online()` follows the `online`/`offline` window events and starts from `navigator.onLine`
  - `<app-offline-banner>` renders `role="status"` text "You are offline. Changes will not be saved until the connection is back." only while offline
  - the specs restore `navigator.onLine` themselves
- [ ] Implement with theme tokens, place the banner in `app.html`, then commit.

### Task 8: global error handler

- [ ] Failing specs:
  - `GlobalErrorHandler.handleError(new Error('x'))` calls `LoggerService.error` with the message, stack and a client id
  - it never throws, even when the logger throws
  - an injected `LOG_SINK` receives the report
- [ ] Implement it, provide it in `app.config.ts` as `{ provide: ErrorHandler, useClass: GlobalErrorHandler }`, then commit.

### Task 9: docs and gate

- [ ] ARCHITECTURE §7.1: the status table follows decision 4. §7.4: `toApiError`, `SILENT_HTTP_ERRORS` with an access state, and `applyServerFieldErrors`.
- [ ] Task 20 file: a `## Status` section. Mark the body shape as provisional until backend 24 lands, and list the remaining callers and stores.
- [ ] SUMMARY rows.
- [ ] Run `npm run check:warnings`, `npm run lint`, and `ng test` three times. Then review, push, and open the PR stacked on #182.
