# Task 06: Cache and share reference data requests

| | |
|---|---|
| Priority | 6 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Store, Performance |
| Depends on | nothing |

## What we found

No request is cached or shared: there is no `shareReplay` in the code and no cache layer. Lookups that rarely change are fetched again by every screen and every dialog that needs them, for example legal entities, leave types, work modes, project categories, task statuses, positions, the employee picker list and the permission list.

When a page with several components opens, each component can fire the same GET at the same moment.

## What to do

1. Add a small `ReferenceDataCache` service in `shared/data-access`: `get(key, loader, maxAge)` returns the cached value, or the in-flight request if one is already running, or starts a new one.
2. Keys must include the selected legal entity where the data depends on it.
3. Clear the whole cache on sign-out and on tenant or legal entity switch. Clear one key after the user changes that data.
4. Move the 10 most repeated lookups to it. Find them by opening the five main screens with the network tab open and counting repeated URLs.
5. Do not cache personal or fast-changing data (attendance status, notifications, task lists).
6. Use the `ETag` the backend adds for reference data (backend task 10) where available.

## Done when

- Opening dashboard, task board, employee list, leave hub and calendar in a row shows each lookup URL at most once.
- A change to a lookup in settings is visible straight away on the next screen.
- The request count per screen before and after is recorded.
