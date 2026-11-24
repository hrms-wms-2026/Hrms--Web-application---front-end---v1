# Task 20: One error handling standard

| | |
|---|---|
| Priority | 20 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | API, Code quality |
| Depends on | backend 24 |

## What we found

- The backend sends several slightly different error bodies today (backend task 24 makes them one shape with a stable `code`).
- The error interceptor already handles sign-out on 401, CSRF errors, the "tray required" 428 case and retries for GET. That is a good base.
- Each store keeps its own `error` value (141 declarations) and each screen decides how to show it: toast, inline text, or nothing. Users get different messages for the same failure.
- `shared/models/problem-details.model.ts` exists but is reported unused.

## What to do

1. Adopt one `ApiError` model (status, code, message, field errors, correlation id) and one `toApiError(httpError)` function. Use or replace the unused problem details model.
2. Write the rules in `docs/core/`:
   - 400 with field errors: show next to the fields;
   - 403: "you do not have access" state, not a toast;
   - 404: empty or not-found state;
   - 409 and 422: show the backend message, it is written for users;
   - 429: "please wait" with the retry time;
   - 5xx and network: one generic toast with the correlation id so support can find the log.
3. Put the mapping in the request helper from task 02 so stores get it for free.
4. Add an offline banner when the browser is offline.
5. Add a global handler that reports unexpected client errors with the correlation id to the logging target the backend team chooses (backend task 17).

## Done when

- The same failure shows the same message on any screen.
- A server error toast shows a correlation id that can be found in the backend logs.
- The rules doc is merged.

## Status (2026-11-24)

Done on branch `chore/error-handling-standard`, stacked on task 24 (#179/#182). Plan: `docs/superpowers/plans/next/2026-11-24-error-handling-standard.md`.

**Backend task 24 has not landed.** This work reads the error bodies the backend sends today. The shape is **provisional** until backend 24 lands. `code` is read whenever it is present, so nothing has to change when backend 24 adds it everywhere. After it lands, check `ProblemDetails` and `toApiError` against `docs/api/errors.md`.

1. **One `ApiError` model** (`core/errors/api-error.ts`): status, kind, code, safe message, field errors, correlation id, retry-after. `toApiError(err)` reuses `toSafeErrorMessage`, so existing screens keep their text (pinned by characterization tests). `shared/models/problem-details.model.ts` now describes every body shape the backend sends.
2. **Rules** are in `docs/core/ARCHITECTURE.md` §7.1 (status → what the user sees) and §7.4 (field errors). No separate file.
3. **Where the mapping lives:** the error interceptor records each request's `X-Correlation-ID`, and `ErrorHandlerService` builds its toasts from `ApiError`.
   - Server-error toasts end with `Reference: <correlation id>`.
   - A 429 says how long to wait when `Retry-After` is readable. That is production, which is same-origin; CORS hides the header in dev.
   - Task 02's shared request helper (Person 2) has not landed. When it does, it should keep `ApiError` next to the store's `error` string.
4. **Offline banner:** `app-offline-banner` in the app shell, driven by `NetworkStatusService`. No network toasts while it shows.
5. **Global handler:** `GlobalErrorHandler` logs unexpected client errors with a client error id through `LoggerService`. `LOG_SINK` is the hook for the log target that backend task 17 will choose. No URL is invented.

Server field errors are shown next to the fields in **general settings** (reference use). The 400 `errors` keys are PascalCase backend property names; the top-level name, first letter lowercased, is the control name.

### Remaining

- 70 files still call `toSafeErrorMessage`/`safeServerDetail` directly. They work and give the same text. Move them to `toApiError` when their module is next touched.
- 34 store `error: string | null` fields. Task 02 (Person 2) owns the shared store request state; add `ApiError` there.
- Forms other than general settings do not yet apply server field errors. Add `saveApiError` + `applyServerFieldErrors` per form.
- Screens with their own access or not-found state should opt out of the 403 toast with `SILENT_HTTP_ERRORS`.
- When backend 24 lands: confirm the body shape, switch screens that match on message text to `code`, and drop the `TENANT_MISMATCH_DETAIL` text check if a code replaces it.
