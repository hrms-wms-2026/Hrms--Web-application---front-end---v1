# Person 4 improvements: what changed and why (2026-11-26)

One branch, `chore/person-4-improvements`, combines all of Person 4's open frontend work from the Improvements plan (`docs/Improvements/person-4-api-layer-and-cleanup/`) into a single PR, on top of the latest `Development`. This document explains every change: the task it comes from, what was wrong before, what changed, why, how it was checked, and what is still open. Read it before reviewing, or when you want to know why some code looks the way it does.

- Owner folder: `docs/Improvements/person-4-api-layer-and-cleanup/` (each task file has its own `## Status` section with the details).
- Plans: `docs/superpowers/plans/next/` (one file per task; listed in `docs/superpowers/plans/SUMMARY.md`).

## 1. What this PR replaces

It replaces these PRs, now closed in favour of this one. Their branches stay on GitHub for history.

| Old PR | Branch | Task |
|---|---|---|
| #180 | `fix/dev-gates` | Make lint and the unit tests pass reliably on Development |
| #192 | `fix/spec-dynamic-import-teardown` | Test runner flake (EnvironmentTeardownError) |
| #178 | `chore/shared-clock` | Task 16: one shared clock and smarter polling |
| #170 | `chore/api-types-generation` | Task 08: API types from the backend contract |
| #177 | `chore/remove-unused-and-duplicates` | Task 12: remove duplicate and unused code |
| #179 | `chore/shared-form-validation` | Task 24: shared form validation rules |
| #182 | `chore/shared-validation-forms` | Task 24 follow-up: the remaining 19 forms |
| #189 | `chore/error-handling-standard` | Task 20: one error handling standard |
| #191 | `chore/server-field-errors` | Task 20 follow-up: server field errors on organization and leave forms |
| #193 | `chore/server-field-errors-profile` | Task 20 follow-up 2: profile panels and checklist builder |
| #194 | `fix/profile-remove-errors` | Task 20 follow-up: refused removes on the profile panels |

Not included: other people's PRs (#197, #181, #172), and Task 04, which was already merged as #169.

## 2. Task status at a glance

| Task | Status in this PR | Waiting on |
|---|---|---|
| 04 Shared API helpers | Already merged (#169) | — |
| 08 API types | Done | CI wiring (no pipeline yet); backend gap report to the backend API owner |
| 12 Duplicate and unused code | Done (−17.2% duplicate lines; target −25% not met, explained in its report) | Owners of 4 "suspected" items |
| 16 Shared clock and polling | Done, browser-checked | Backend `notificationsChanged` event (then plan Task 11) |
| 20 Error handling standard | Done + 3 follow-ups | Backend task 24 (uniform error body with `code`) for a final check |
| 24 Shared form validation | Done (22 forms) | Module owners for the 3 large forms |
| 25 Permission codes | Not started | Backend task 32 (permission catalogue) |

## 3. Test and lint gates (from #180 and #192)

**Problem:** on `Development`:
- `npm run lint` failed.
- `ng test` failed on any machine whose locale is not en-US.
- The suite was flaky: about one run in three had 1–14 failures, depending on the order the spec files ran in.

**What changed and why:**
- **7 ESLint a11y errors** in `calendar-page.component.html` and `planner-create-popover.component.ts`. They are fixed the way CLAUDE.md asks: backdrops get `role="presentation"`, and `(click)="$event.stopPropagation()"` becomes `appStopClickPropagation`. Behaviour is unchanged.
- **HttpParams guard:** `support-tickets-api.service.ts` uses `toHttpParams`. The query is the same, and an empty status is still dropped.
- **Colour guard:** the Teams and Zoom logo fills are brand colours, which is the exception the guard documents, so they go in the baseline with the reason. The baseline counts were also lowered where colours had already gone.
- **`src/test-setup.ts`** (new; `angular.json` → `test.options.setupFiles`):
  - Pins the default locale to en-US for formatters called without a locale, so "Aug 17" is not "17 Aug" on an en-GB machine. An explicit locale is kept.
  - Vitest runs all spec files of a worker in one context (`isolate: false`), so one spec's leftovers broke later ones. Around every test the setup restores the real timer globals, `requestAnimationFrame`, `matchMedia` and `document.visibilityState`. One cause was proven with a probe: a spy made under fake timers brings back a dead fake `setTimeout` through `restoreAllMocks`, which made unrelated specs hang.
  - After each spec file it waits for dynamic `import()`s still in flight (`vi.dynamicImportSettled()`, #192). A lazy chunk still loading when the worker closed made the next spec file fail with `EnvironmentTeardownError`.
  - Rule for specs (written in the file): set fake timers and global stubs in `beforeEach` or in the test, never in `beforeAll`.
- **`vitest.config.ts`:** test timeout 15 s. Whole-page specs (main layout, position management) pass in about 1 s alone, but went past 5 s under full parallel load. A real hang still fails.
- **Error interceptor spec:** its router now has an `auth/login` route, so the real navigation on 401 no longer rejects without a handler.

## 4. Task 16: one shared clock and smarter polling (from #178)

**Problem:** about 18 components ran their own `setInterval` just to update a "now" signal, some every second. The notification bell polled even while the tab was hidden.

**What changed:**
- `core/clock/clock.service.ts` provides `injectNow('second' | 'minute')`. It runs one timer per rate, only while something reads it, and none while the tab is hidden. The minute clock turns over on the wall-clock minute.
- Every "now" reader moved to it. A `setInterval(` search in `src/app` now finds only the clock service and two real animations.
- `ClockService.poll()` for the planner leave layer, the attendance detail drawer and the notification bell: polls pause while the tab is hidden and refresh once when it is back.
- `InboxRealtimeService.notificationsChanged$`: the bell refreshes on a hub push and after a reconnect.

**Checked:** specs, plus a browser check on 2026-11-24 (one minute timer, no network polls while hidden, one refresh on return). **Open:** plan Task 11 (slow fallback poll) after the backend sends `notificationsChanged`.

## 5. Task 08: API types from the backend contract (from #170)

`npm run api:types` generates `src/app/shared/api-types/backend-api.generated.ts` from the backend OpenAPI document, and `npm run api:types:check` fails on drift. The Leave module is the reference: its request DTOs are checked against the generated types, and 6 became aliases. See `docs/core/API_TYPES.md` and `task-08-backend-contract-gaps.md`.

**Note for local runs:** this adds the dev dependency `openapi-typescript`. Run `npm install` once before `npm run api:types`. Build and tests do not need it.

## 6. Task 12: remove duplicate and unused code (from #177)

Duplicate lines went from 3,713 to 3,073 (−17.2%). Unused files and exports were removed: `build-info.ts`, `feature-flags.ts`, `landing-dashboard-preview`, `metric-stat`, and others. Shared helpers replaced copies: one auth session patch, shared new-password fields, organization archive modals, attendance formatters, and 6 dashboard cards moved to `injectHostSize()`. The report `task-12-cleanup-report.md` labels every finding and explains the 289-line gap to the −25% target.

## 7. Task 24: shared form validation rules (from #179 and #182)

**Problem:** every form had its own rules and messages, and several limits were **looser than the backend**. The user filled in a form that looked valid and then got a server error.

**What changed:**
- `shared/utils/validators/`:
  - Pure rules (`validation-rules.ts`). `requiredText` trims, like the backend's `ValidName`. Rich text counts the stored HTML, like `ValidRichText`.
  - `AppValidators` for reactive forms.
  - One message map, `validationMessage()` / `fieldError()`.
  - `<app-field-error>` for fields that are not `app-input`.
- Limits live in `modules/<module>/utils/<module>-limits.ts`. Each constant names the backend validator it mirrors.
- 22 forms moved: organization (department, role, position, coverage, company, general settings), leave (leave type, leave request), auth (login, forgot, reset, invitation, plus the shared new-password fields), profile (personal info, contacts, dependents, payroll, security), people (checklist builder, job info, offboarding), calendar event, and meeting.
- `ProfileValidators` and `shared/utils/validation.helpers.ts` are deleted, because the shared rules replace them.

**Drift fixed (frontend was looser than the backend):**

| Field | Before | Backend | Now |
|---|---|---|---|
| Department name | 200 | 100 | 100 |
| Department code | no pattern | `^[A-Za-z0-9_-]{1,20}$` | pattern |
| Role name | 100 | 50, `^[A-Za-z0-9 _-]+$` | 50 + characters |
| Role description | 500 | 255 | 255 |
| Checklist name | 150 | 100 | 100 |
| Emergency contact / dependent / bank fields | no limit | 20–255 | backend sizes |
| Offboarding notes | no limit | 4000 | 4000 |
| Meeting title | no limit | 500 | 500 |

**Rule:** a frontend limit may be stricter than the backend's, never looser. Stricter limits we kept on purpose are listed in the task 24 file. Email checks stay `Validators.email`, like the backend's `EmailAddress()`, so addresses such as `user@localhost` can still log in.

## 8. Task 20: one error handling standard (from #189, #191, #193, #194)

**Problem:** the backend sends several error body shapes, each screen showed errors its own way, server-error toasts had no reference support could search for, field errors from a 400 never reached their fields, and some failures showed nothing at all.

**What changed:**
- `core/errors/api-error.ts`: `ApiError` + `toApiError(err)` (status, kind, code, safe message, field errors, correlation id, retry-after).
  - The message is exactly the old `toSafeErrorMessage` text; characterization tests pin it.
  - The thrown value is still an `HttpErrorResponse`.
  - `code` is read whenever present, so backend task 24 slots in.
- The error interceptor records each request's own `X-Correlation-ID`. Server-error toasts end with `Reference: <id>`, which matches the backend log.
- A 429 says how long to wait when `Retry-After` is readable.
- The offline banner (`app-offline-banner`) shows while the browser is offline, with no network toasts meanwhile.
- `GlobalErrorHandler` logs unexpected client errors with a client id. `LOG_SINK` is the hook for backend task 17's log target.
- **Server field errors** (`applyServerFieldErrors`, `failedSaveToast`): a refused save shows each message next to its field.
  - Forms covered: general settings, department, role, leave type, create company, profile personal info, emergency contacts, dependents, payroll, and the checklist builder.
  - A message for a field the form does not show goes to the form level.
  - A page toasts at most once.
  - A reopened form starts clean.
- Rules: `docs/core/ARCHITECTURE.md` §7.1 (status → what the user sees) and §7.4 (field errors).

**Bugs fixed on the way:**
- Emergency contact, dependent and payroll saves, and contact and dependent removes, refused with 400/404/409 showed **nothing**.
- A failed checklist save toasted twice, and three times on a 5xx.
- The contact and dependent add forms cleared before the server answered, so a refused add lost what the user typed.
- The personal info banner showed other tabs' errors.

**Open:**
- When backend task 24 lands, confirm the body shape.
- 403 is still a toast by default; screens opt out with `SILENT_HTTP_ERRORS` and show an access state.
- About 70 files still call `toSafeErrorMessage` directly. They give the same text; move them when touched.
- The position form and the people forms are with their owners.

## 9. Conflicts resolved while combining

| File | Why it conflicted | Resolution |
|---|---|---|
| `core/auth/feature/login/*` | Development added Google sign-in (workspace selector, remembered account) | Kept Development's page; re-applied task 24's change (messages via `fieldError`) |
| `core/auth/state/auth.store.ts` | Development restructured the store around `applyAuthResponse` for Google sign-in; task 12 had added a `sessionState()` helper on the old structure | Kept Development's version. `applyAuthResponse` already removes the duplicate patches task 12 targeted |
| `accept-invitation` / `reset-password` | Task 12 moved the password inputs into `app-new-password-fields`; task 24 had changed their messages inline | Kept task 12's shared component and moved task 24's change into it (`errorFor()` uses the shared message map). Its spec now expects "Password is required." for an empty touched field |
| `accept-invitation.component.ts` | After task 12 branched off, Development added the invitation `purpose` (tenant owner invites, `b41c6e36`) | Rebuilt from Development's file, then applied task 12's shared password fields and task 24's `AUTH_LIMITS`. The first attempt took task 12's older file and dropped `purpose`; the full suite caught it, and it is fixed |
| `docs/superpowers/plans/SUMMARY.md`, `next/SUMMARY.md` | Each branch added its own rows | Kept every row |

## 10. How it was checked

- `npm run check:warnings`: clean.
- `npm run lint`: ESLint 0 errors / 0 warnings, and the HttpParams and colour guards pass.
- `ng test`: full suite on 3 consecutive runs (numbers in the PR description).
- Every task branch had a code review before this combination, and all critical and important findings were fixed (listed in each old PR).

To check locally: `npm install`, then `npm run check:warnings`, `npm run lint`, `npx ng test --watch=false`.

## 11. Questions people ask

- **Why is the test timeout 15 s?** Whole-page specs pass in about 1 s alone but take longer under full parallel load on a laptop. A real hang still fails. Follow-up: make those specs lighter.
- **Why do some limits stay stricter than the backend (leave reason 500 vs 2000)?** That is a product decision, not a bug. We never allow more than the backend, but we may allow less. The task 24 file lists each one.
- **Why is 403 still a toast?** Making it silent everywhere would leave screens without an access state showing nothing. Screens move one by one with `SILENT_HTTP_ERRORS`.
- **Will this break when backend task 24 changes the error body?** No. `toApiError` reads every shape the backend sends today and picks up `code` when present. Recheck `ProblemDetails` against `docs/api/errors.md` once it exists.
- **Where do I add a new form's validation?** Use `AppValidators`, a limit in your module's `*-limits.ts` that names the backend validator, `fieldError()` in the template, and for a save, `applyServerFieldErrors` + `failedSaveToast` (ARCHITECTURE §6.4, §7.4).
- **Why is `vi.dynamicImportSettled()` in the test setup?** See section 3. Without it, a lazy chunk still loading at the end of a spec file made the next spec file fail as a whole.
