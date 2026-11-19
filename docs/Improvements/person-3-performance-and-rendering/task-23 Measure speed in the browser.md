# Task 23: Measure speed in the browser

| | |
|---|---|
| Priority | 23 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Performance, Observability |
| Depends on | backend 17 |

## What we found

Nothing in the frontend measures how fast the app is for a real user. The team target is 200 ms per API call, but today nobody can say which screen breaks it, how many calls a screen makes, or how long the first load takes on a normal office laptop.

## What to do

1. Add a timing step to an HTTP interceptor: record method, route template (ids replaced), status and duration. In Development print a warning for any call above 200 ms. Never record request or response bodies.
2. Count requests per route navigation and warn in Development when one navigation makes more than an agreed number (start with 10).
3. Collect Core Web Vitals (LCP, INP, CLS) with the `web-vitals` library.
4. Send a sampled summary to the monitoring target the backend team sets up (backend task 17), with tenant and correlation id but no personal data.
5. Create a baseline table: for each main screen, the number of requests, the slowest call, total transfer size and LCP, measured on UAT with the seeded data.
6. Save it as `docs/reports/2026-11-frontend-performance-baseline.md` and repeat it after tasks 03, 06, 07 and 18 to show the gain.

## Done when

- The baseline table exists for every main screen.
- A developer sees a console warning the moment a call is slower than 200 ms.
- Web vitals from UAT are visible on a dashboard.
