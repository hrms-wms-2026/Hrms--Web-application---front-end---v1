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
