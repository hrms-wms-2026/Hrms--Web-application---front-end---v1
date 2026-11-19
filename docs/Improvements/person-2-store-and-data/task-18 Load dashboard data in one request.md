# Task 18: Load dashboard data in one request

| | |
|---|---|
| Priority | 18 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Performance, Store |
| Depends on | backend 20 |

## What we found

`dashboard-layout-api.service.ts` loads the layout through `GET {id}/bootstrap` and then loads each widget's data separately through `GET /dashboard-widgets/{instanceId}/data`. A dashboard with 12 widgets makes 13 requests on every visit, and every refresh repeats them. Each request pays the backend's authentication cost again, so the dashboard is the slowest first impression of the app.

The backend team is adding a batch endpoint (backend task 20).

## What to do

1. Agree the batch contract with the backend: a list of widget instance ids in, one result per widget out, each with its own status so one failing widget does not break the rest.
2. Add a `DashboardDataLoader` that collects the data requests of all visible widgets for a short moment (one animation frame) and sends one batch call.
3. Load widgets below the fold later: use `@defer (on viewport)` and a second batch.
4. Keep each widget's own loading and error state. A widget must not know it was batched.
5. Refresh rules: one manual refresh button reloads all; a single widget can refresh itself; no automatic full reload on a timer.
6. Show the previous data while fresh data loads, so the dashboard does not blank on return.
7. Follow `docs/design/WIDGET_CREATION_RULES.md` for any widget change.

## Done when

- Opening the dashboard makes at most 3 data requests.
- One failing widget shows its own error and the others render.
- Time to all widgets filled is measured before and after.
