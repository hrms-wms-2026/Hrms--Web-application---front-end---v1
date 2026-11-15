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
