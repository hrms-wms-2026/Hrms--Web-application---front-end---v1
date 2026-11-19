# Frontend improvements (Hrms--Web-application---front-end---v1)

Written 2026-11-15 from a read-only scan of the whole web frontend on branch `feature/role-dashboard-templates`. No code was changed. Every file in the person folders is one task for one person for one day.

The backend has its own folder with the same layout: `HRMS-Backend-v1/docs/Improvements`. Several tasks here depend on a backend task; the dependency column says which.

## How to use this folder

- Four people, four folders. Each person works through their own folder from the lowest task number up.
- The task number is the priority across the whole frontend. Task 01 is the most urgent, task 24 the least.
- The first 9 tasks are the ones to finish before UAT opens.
- Run `npm run check:warnings` and `npm run lint` before every commit, as the repository rules require.

## Targets the team agreed

- Every API call answers in 200 ms or less. The frontend's part: ask for less data, ask less often, never ask twice for the same thing.
- Any list that can hold more than 50 rows uses server-side pagination.
- The app keeps working smoothly with 20,000 tasks and 500 employees in one tenant.

## What the scan found (short version)

| Area | Finding | Evidence |
|---|---|---|
| Deployment | There is no CI at all. No `.github/workflows` folder | repo root |
| Deployment | No hosting config: no Dockerfile, no web server config, no cache or security headers defined | repo root |
| Store | 65 store files. 56 are `providedIn: 'root'`, so their data stays in memory for the whole session | grep over `*.store.ts` |
| Store | The same `loading`, `saving`, `error` state is written by hand in almost every store (164, 141 and 141 times) | grep over `*.store.ts` |
| Store | 315 `firstValueFrom` calls in stores and only 3 `rxMethod`. A slow old request can overwrite a newer one | grep over `*.store.ts` |
| Data | 508 HTTP calls in 68 API files, no shared cache and no `shareReplay`. The same lookups are fetched again by every screen | grep over `src/app` |
| Data | 76 hand-built `HttpParams` blocks | grep |
| Data | Dashboard widgets load one request per widget | `dashboard-layout-api.service.ts:63` |
| Rendering | No virtual scrolling anywhere (0 uses of `cdk-virtual-scroll`) | grep |
| Rendering | 94 of 414 components are not `OnPush` (45 in `modules/work/ui`). The app is not zoneless | grep |
| Rendering | About 18 components run their own `setInterval` clock, some every second | grep |
| Rendering | Very large components: `task-form-modal` 3,770 lines, `rich-text-editor` 2,746, `task-board-column` 1,542 | line counts |
| Security | 9 `[innerHTML]` bindings, DOMPurify used in 2 files | grep |
| Security | No Content Security Policy in `index.html` or in any host config | `src/index.html` |
| Code quality | 295 duplicate blocks (3,881 lines), 30 unused files, exports and types | dev-env cleanup scan of 2026-11-13 |

## What is already good (do not redo)

- Signals and `@ngrx/signals` everywhere, no `BehaviorSubject`, no `*ngFor`, almost no `any`.
- HTTP calls live in API services, not in components (only 1 component injects `HttpClient`).
- Cookie session with a CSRF interceptor. No token is kept in `localStorage`; the 12 keys there are display preferences.
- Same-origin API URL built from the tenant host, with staging and production build configurations.
- Lazy routes (52 `loadComponent`, 9 `loadChildren`) and a bundle budget.
- The error interceptor retries only GET and HEAD.

## Limits of this scan

- It was a static read of the code. Nothing was profiled in a browser, so rendering cost and bundle size here are not measured numbers. Tasks 19 and 23 produce them.
- The platform admin frontend repository was not scanned.

## API change management decision (2026-11-15)

The team manages API changes with **feature keys** (backend tasks 43 and 16). The frontend hides menus, routes and buttons from the tenant feature key list in `auth/me`. Task 25 was updated with the frontend side.

## Urgent tasks (added 2026-11-15 after measuring)

The API was measured on 2026-11-15 through the real frontend. The report is in the backend repository: `docs/reports/performance/2026-11-15-api-response-timings.md`. The Inbox screen calls the two slowest endpoints twice each, and inbox counts runs on every page load. Do this before task 01:

| # | Task | Owner folder |
|---|---|---|
| 00a | [Stop duplicate inbox, chat and shell requests](<person-2-store-and-data/task-00a Stop duplicate inbox, chat and shell requests.md>) | person-2-store-and-data |

## Added after the outbox and permission checks (2026-11-15)

The backend permission system was reviewed (backend repository: `docs/reports/security/2026-11-15-permission-system-review.md`). This task is not in the table below:

| # | Task | Owner folder |
|---|---|---|
| 25 | [Permission codes from one generated file](<person-4-api-layer-and-cleanup/task-25 Permission codes from one generated file.md>) | person-4-api-layer-and-cleanup |

## Priority order (all tasks)

Build in this order. Each person works through their own folder from the lowest number up.

| # | Task | Owner folder | Area | Depends on |
|---|---|---|---|---|
| 01 | [CI pipeline for the frontend](<person-1-security-and-deployment/task-01 CI pipeline for the frontend.md>) | person-1-security-and-deployment | Deployment | - |
| 02 | [One shared pattern for store request state](<person-2-store-and-data/task-02 One shared pattern for store request state.md>) | person-2-store-and-data | Store | - |
| 03 | [Server-side pagination in list screens](<person-3-performance-and-rendering/task-03 Server-side pagination in list screens.md>) | person-3-performance-and-rendering | Pagination, Performance | backend 04, 08, 12 |
| 04 | [Shared helpers for the API layer](<person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md>) | person-4-api-layer-and-cleanup | API, Code quality | - |
| 05 | [Hosting setup for UAT](<person-1-security-and-deployment/task-05 Hosting setup for UAT.md>) | person-1-security-and-deployment | Deployment, Performance | 01 |
| 06 | [Cache and share reference data requests](<person-2-store-and-data/task-06 Cache and share reference data requests.md>) | person-2-store-and-data | Store, Performance | - |
| 07 | [Virtual scrolling for long lists](<person-3-performance-and-rendering/task-07 Virtual scrolling for long lists.md>) | person-3-performance-and-rendering | Performance, Rendering | - |
| 08 | [Generate API types from the backend contract](<person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md>) | person-4-api-layer-and-cleanup | API, Code quality | - |
| 09 | [Content Security Policy and browser security headers](<person-1-security-and-deployment/task-09 Content Security Policy and browser security headers.md>) | person-1-security-and-deployment | Security, Deployment | 05 |
| 10 | [Store lifetime and reset rules](<person-2-store-and-data/task-10 Store lifetime and reset rules.md>) | person-2-store-and-data | Store | - |
| 11 | [OnPush everywhere and zoneless readiness](<person-3-performance-and-rendering/task-11 OnPush everywhere and zoneless readiness.md>) | person-3-performance-and-rendering | Performance, Rendering | - |
| 12 | [Remove duplicate and unused code](<person-4-api-layer-and-cleanup/task-12 Remove duplicate and unused code.md>) | person-4-api-layer-and-cleanup | Code quality | - |
| 13 | [One safe way to render user HTML](<person-1-security-and-deployment/task-13 One safe way to render user HTML.md>) | person-1-security-and-deployment | Security | - |
| 14 | [Cancel stale requests and update lists without full reloads](<person-2-store-and-data/task-14 Cancel stale requests and update lists without full reloads.md>) | person-2-store-and-data | Store, Performance | 02 |
| 15 | [Split the largest components](<person-3-performance-and-rendering/task-15 Split the largest components.md>) | person-3-performance-and-rendering | Architecture, Code quality | - |
| 16 | [One shared clock and smarter polling](<person-4-api-layer-and-cleanup/task-16 One shared clock and smarter polling.md>) | person-4-api-layer-and-cleanup | Performance | - |
| 17 | [Dependency checks and browser storage review](<person-1-security-and-deployment/task-17 Dependency checks and browser storage review.md>) | person-1-security-and-deployment | Security | 01 |
| 18 | [Load dashboard data in one request](<person-2-store-and-data/task-18 Load dashboard data in one request.md>) | person-2-store-and-data | Performance, Store | backend 20 |
| 19 | [Bundle size and first load](<person-3-performance-and-rendering/task-19 Bundle size and first load.md>) | person-3-performance-and-rendering | Performance | 01 |
| 20 | [One error handling standard](<person-4-api-layer-and-cleanup/task-20 One error handling standard.md>) | person-4-api-layer-and-cleanup | API, Code quality | backend 24 |
| 21 | [UAT smoke tests](<person-1-security-and-deployment/task-21 UAT smoke tests.md>) | person-1-security-and-deployment | Deployment, Quality | 05 |
| 22 | [Stable list tracking and cheaper computed state](<person-2-store-and-data/task-22 Stable list tracking and cheaper computed state.md>) | person-2-store-and-data | Performance, Store | - |
| 23 | [Measure speed in the browser](<person-3-performance-and-rendering/task-23 Measure speed in the browser.md>) | person-3-performance-and-rendering | Performance, Observability | backend 17 |
| 24 | [Shared form validation rules](<person-4-api-layer-and-cleanup/task-24 Shared form validation rules.md>) | person-4-api-layer-and-cleanup | Code quality, API | backend 19 |

## Tasks per person

### person-1-security-and-deployment

- 01: [CI pipeline for the frontend](<person-1-security-and-deployment/task-01 CI pipeline for the frontend.md>)
- 05: [Hosting setup for UAT](<person-1-security-and-deployment/task-05 Hosting setup for UAT.md>)
- 09: [Content Security Policy and browser security headers](<person-1-security-and-deployment/task-09 Content Security Policy and browser security headers.md>)
- 13: [One safe way to render user HTML](<person-1-security-and-deployment/task-13 One safe way to render user HTML.md>)
- 17: [Dependency checks and browser storage review](<person-1-security-and-deployment/task-17 Dependency checks and browser storage review.md>)
- 21: [UAT smoke tests](<person-1-security-and-deployment/task-21 UAT smoke tests.md>)

### person-2-store-and-data

- 02: [One shared pattern for store request state](<person-2-store-and-data/task-02 One shared pattern for store request state.md>)
- 06: [Cache and share reference data requests](<person-2-store-and-data/task-06 Cache and share reference data requests.md>)
- 10: [Store lifetime and reset rules](<person-2-store-and-data/task-10 Store lifetime and reset rules.md>)
- 14: [Cancel stale requests and update lists without full reloads](<person-2-store-and-data/task-14 Cancel stale requests and update lists without full reloads.md>)
- 18: [Load dashboard data in one request](<person-2-store-and-data/task-18 Load dashboard data in one request.md>)
- 22: [Stable list tracking and cheaper computed state](<person-2-store-and-data/task-22 Stable list tracking and cheaper computed state.md>)

### person-3-performance-and-rendering

- 03: [Server-side pagination in list screens](<person-3-performance-and-rendering/task-03 Server-side pagination in list screens.md>)
- 07: [Virtual scrolling for long lists](<person-3-performance-and-rendering/task-07 Virtual scrolling for long lists.md>)
- 11: [OnPush everywhere and zoneless readiness](<person-3-performance-and-rendering/task-11 OnPush everywhere and zoneless readiness.md>)
- 15: [Split the largest components](<person-3-performance-and-rendering/task-15 Split the largest components.md>)
- 19: [Bundle size and first load](<person-3-performance-and-rendering/task-19 Bundle size and first load.md>)
- 23: [Measure speed in the browser](<person-3-performance-and-rendering/task-23 Measure speed in the browser.md>)

### person-4-api-layer-and-cleanup

- 04: [Shared helpers for the API layer](<person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md>)
- 08: [Generate API types from the backend contract](<person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md>)
- 12: [Remove duplicate and unused code](<person-4-api-layer-and-cleanup/task-12 Remove duplicate and unused code.md>)
- 16: [One shared clock and smarter polling](<person-4-api-layer-and-cleanup/task-16 One shared clock and smarter polling.md>)
- 20: [One error handling standard](<person-4-api-layer-and-cleanup/task-20 One error handling standard.md>)
- 24: [Shared form validation rules](<person-4-api-layer-and-cleanup/task-24 Shared form validation rules.md>)
