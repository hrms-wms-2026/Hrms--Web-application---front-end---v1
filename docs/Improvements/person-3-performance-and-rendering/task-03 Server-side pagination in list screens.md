# Task 03: Server-side pagination in list screens

| | |
|---|---|
| Priority | 3 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Pagination, Performance |
| Depends on | backend 04, 08, 12 |

## What we found

The backend returns whole collections from many list endpoints (projects, sprint tasks, comments, objectives, leave approvals and balances, attendance requests, notifications). The frontend then filters, sorts and pages in the browser. With real UAT data this means large downloads and slow screens.

The backend team is adding one pagination contract (backend task 04: `page`, `pageSize`, `PagedResult` with `items`, `page`, `pageSize`, `totalCount`; cursor form for feeds) and applying it in backend tasks 08 and 12.

## What to do

1. Add shared types in `shared/models`: `PageRequest`, `PagedResult<T>`, `CursorPage<T>`.
2. Add a `withPagination()` store feature: current page, page size, total, `goToPage`, `setPageSize`, and a reset to page 1 whenever a filter or the sort changes.
3. Make the shared `app-data-table` work in server mode: it emits page, sort and filter changes and shows the total from the server.
4. Move filters and sorting to query parameters. Debounce text filters by 300 ms.
5. Keep page and filters in the URL so refresh and back keep the place.
6. Start with the three heaviest screens: project list, task backlog and leave approvals.
7. For feeds (comments, activity, notifications) use "load more" with the cursor.

## Done when

- The three screens request one page at a time. The network tab shows no list response above 100 rows.
- Changing a filter resets to page 1 and cancels the previous request.
- The list of screens still to move is written down.
