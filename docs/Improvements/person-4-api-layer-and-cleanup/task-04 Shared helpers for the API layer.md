# Task 04: Shared helpers for the API layer

| | |
|---|---|
| Priority | 4 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | API, Code quality |
| Depends on | nothing |

## What we found

There are 68 API service files with 508 HTTP calls. Each one builds its own URL and query string:

- `new HttpParams()` is built by hand in 76 places, each with its own rules for skipping empty values, formatting dates and sending arrays.
- List responses are typed separately in each module.
- Some services return the raw backend shape, others map it. There is no rule for where mapping lives.

Small differences here cause real bugs: a date sent in local time in one screen and in UTC in another, or an empty filter sent as an empty string that the backend treats as a value.

## What to do

1. Add `shared/data-access/api-params.ts` with one `toHttpParams(object)` function: skips null, undefined and empty strings, formats dates one way (ISO, date-only where the backend expects a date), repeats the key for arrays.
2. Add a small `ApiClient` base or helper functions for `getPage`, `getOne`, `post`, `put`, `delete` that always use `environment.apiUrl`.
3. Write the layer rules in `docs/core/`: API services return backend DTOs; mapping to view models happens in the store or a mapper file; components never call an API service directly when a store exists.
4. Move one module (suggest Leave, medium size) to the helpers as the reference.
5. Add a lint rule or a simple script check that flags `new HttpParams(` outside the helper.

## Done when

- The helper has unit tests for dates, arrays and empty values.
- One module uses it everywhere.
- The remaining modules are listed with the count of call sites each.

## Status (2026-11-18)

- Helpers: `src/app/shared/data-access/api-params.ts` (`toHttpParams`, `dateOnly`) and `src/app/shared/data-access/api-client.ts` (`ApiClient`), with unit tests.
- Reference module: Leave. All 8 API services use `ApiClient`; no `HttpClient` or `HttpParams` left.
- Guard: `scripts/check-http-params.mjs` runs in `npm run lint`; baseline `scripts/http-params-baseline.json` (31 files, 67 call sites) may only shrink.
- Rules: `docs/core/ARCHITECTURE.md` §5.1.
- Before the next module: `ApiClient` has no `patch`, `headers`, `context` (`HttpContext`) or `observe` option yet. People, Inbox and Work need them; see the gap list in `docs/core/ARCHITECTURE.md` §5.1.
- The HttpParams guard runs first in `npm run lint` (before ESLint), so it still runs while the pre-existing ESLint a11y errors and colour-guard failures on Development are open.
- Not done here: the two module-local `PagedResultDto` types (attendance, work) still need to move to `shared/models/paged-result.model.ts`.

### Remaining modules

Generated with `node scripts/check-http-params.mjs --report`. Highest call count first. The `shared` row includes `ApiClient` itself (7 calls), which stays on `HttpClient` by design.

| Module | Files calling HttpClient | Raw HttpClient calls | `new HttpParams(` sites |
|---|---|---|---|
| work | 12 | 142 | 9 |
| people | 5 | 83 | 17 |
| organization | 4 | 45 | 7 |
| inbox | 4 | 42 | 7 |
| attendance | 4 | 32 | 8 |
| dashboard | 19 | 31 | 17 |
| settings | 5 | 23 | 1 |
| calendar | 1 | 20 | 0 |
| profile | 1 | 19 | 0 |
| core | 4 | 18 | 1 |
| shared | 3 | 11 | 0 |
| device-activation | 1 | 2 | 0 |
