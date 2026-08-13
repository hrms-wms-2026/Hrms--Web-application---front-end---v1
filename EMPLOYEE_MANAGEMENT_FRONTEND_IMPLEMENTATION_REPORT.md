# Employee Management — Phase 1 Foundation: Frontend Implementation Report

**Scope delivered:** People → Employees list (employees + onboarding drafts), Add Employee wizard (draft save/resume only), a minimal read-only Employee detail page. No final-creation UI, no invitation UI — matching the backend, which does not implement those (see backend report).

**Branch:** `feature/employee-management-phase1-foundation`, commits `da38690..099f95e` (9 commits, including a post-verification bug fix — see [Bug found and fixed during manual verification](#bug-found-and-fixed-during-manual-verification-live-testing)).

---

## Routes

Added to `src/app/modules/people/people.routes.ts`, lazy-loaded from `app.routes.ts` under the existing `people` path (`canActivate: [permissionGuard]`, `data: { permissions: ['employees:read','employees:write'], modules: ['core_hr'] }` — unchanged from the pre-existing placeholder entry, now pointing at real feature code instead of the placeholder):

| Path | Component | Route-level permission |
|---|---|---|
| `/people/employees` | `EmployeeListComponent` | `employees:read` |
| `/people/employees/new` | `AddEmployeeWizardComponent` | `employees:write` |
| `/people/employees/:id` | `EmployeeDetailComponent` | `employees:read` |

`/people` itself redirects to `/people/employees`. Only these three routes exist — no bulk import, transfer, promotion, offboarding, or self-service routes were added.

## Files changed (20 files, +2,209/-1 across commits `da38690..099f95e`, plus the post-verification fix)

**Models:** `models/employee.model.ts`, `models/onboarding-draft.model.ts` (incl. `DRAFT_REASON_LABELS`/`DRAFT_STATUS_LABELS` display maps — no fabricated statuses, values map 1:1 to backend enums).

**Data access:** `data-access/people-api.service.ts` (+ spec) — `listEmployees`, `getEmployee`, `saveDraft` (branches `POST`/`PUT` on `payload.draftId`), `getDraft`, `listDrafts`.

**State:** `state/people.store.ts` (+ spec) — list-page NgRx Signal Store, monotonic request-id counters guard against stale-response races on rapid filter changes. `state/add-employee-wizard.store.ts` (+ spec) — wizard state: company/department/position selection (reusing the existing `organization` module's `DepartmentApiService`/`PositionApiService`, not reimplementing them), form value, draft id/version, save/resume status.

**UI components:** `ui/employee-table/employee-table.component.ts` (+ spec), `ui/draft-table/draft-table.component.ts` (+ spec) — presentational, `OnPush`, no direct API access.

**Feature components:** `feature/employee-list/employee-list.component.ts` (+ spec) — search/filter/pagination synced to the URL, four render states (loading/error-with-retry/empty/loaded). `feature/add-employee-wizard/add-employee-wizard.component.ts` + `.html` (+ spec) — 4-step wizard. `feature/employee-detail/employee-detail.component.ts` — minimal read-only view (see [Known gap: detail page](#known-gap-detail-page)).

**Routing:** `people.routes.ts`, `app.routes.ts` (People placeholder replaced with the real lazy-loaded module).

## Add Employee fields

Exactly the documented set: Company (read-only, from the currently selected legal entity), Full name, Work email, Department (dependency-filtered dropdown, disabled with an explicit empty state when the company has zero departments), Position (dependency-filtered on Department), Employment type (Full-time/Part-time/Contractor/Intern), Start date, Employee number (optional, "leave blank if auto-generated"). Schedule/Shift and Checklist Template are rendered as explicit **unavailable** states ("Schedule/Shift is not yet configured for your organization") rather than fabricated dropdown options, since no backend source exists for either (see backend report blocker #3). No manager field, no job-title field, no phone/address/emergency-contact/photo/bank/payroll fields anywhere in the form — verified both by an automated test (`does not render a manager or job title field anywhere in the form`) and by inspecting the rendered DOM live.

## Draft behavior

- The primary action is always labeled **"Save Draft"** — never "Create Employee" or "Send Invite" (enforced by test and confirmed live).
- Save Draft is disabled/no-ops while a save is already in flight (`store.saving()` guard in `onSaveDraft()`), preventing duplicate submission from a double-click.
- A failed save preserves all entered form values (verified live: typed values survive a 500 response) and shows a mapped safe message (`toSafeErrorMessage`) — never the raw backend body (verified live: a synthetic `Npgsql.PostgresException` detail string was not present in the rendered error).
- Save Draft correctly appears in the employee list's "Onboarding drafts" table with status, human-readable reason (`Waiting for seat` / `Waiting for position approval` / etc.), last saved step, and who started it, with a "Continue Draft" action that navigates to `/people/employees/new?draftId=...` and resumes at the last saved step with all fields repopulated (verified live end-to-end against the real backend).

## Error/toast behavior

All API errors flow through the existing `toSafeErrorMessage` mapper before reaching the UI or `NotificationService` — no raw endpoint paths, DB error text, or status-code numbers are ever shown to the user. Verified both by unit test and live (a 400 validation failure and a synthetic 500 both rendered as plain-language messages).

## Bug found and fixed during manual verification (live testing)

Manual browser verification against the running backend (dev tenant `acme.localhost`) surfaced a real bug that all 421 automated frontend tests had missed: `AddEmployeeWizardComponent`'s constructor read `legalEntityStore.selectedLegalEntity()` **once, synchronously**, but that store populates the selection **asynchronously** after `loadCompanies()` resolves. On a fresh page load, the constructor ran before the company loaded, so the wizard's own `AddEmployeeWizardStore.companyId()` was never set — Save Draft then sent `legalEntityId: ''`, which the backend correctly rejected with `400` (`Guid` required).

This was masked in tests because `add-employee-wizard.component.spec.ts`'s `setupWithCompany()` helper always awaits the company load *before* creating the component fixture — the same class of "the mock/fixture setup accidentally fixes the timing that production doesn't have" issue documented in the backend report for `EfEmployeeRepository` (EF InMemory masking a real Npgsql translation failure).

**Fix (commit `099f95e`):** the constructor now watches `selectedLegalEntity()` via an `effect()` instead of a one-time read, syncing `store.setCompany()` reactively whenever the company becomes available or changes — skipped entirely while resuming an existing draft, so it can't clobber the draft's own `legalEntityId` with whatever company happens to be currently selected. Re-verified: all 421 tests still pass, and a live retry of Save Draft against the real backend returned `201` with the correct `legalEntityId`.

## Manual browser verification performed (live, against real backend + acme dev tenant)

- Logged in as the seeded Acme Owner (`org:manage`, full visibility) via the tenant-subdomain HTTPS dev server (`acme.localhost:4200` ↔ `acme.localhost:7229`).
- Employees list loaded real data (3 employees, joined names/legal entity/status), with "+ Add Employee" visible (caller has `employees:write`).
- Add Employee wizard: precondition-missing states rendered correctly for zero departments and unconfigured Schedule/Shift (no fabricated options).
- Client-side validation blocked Continue with empty required fields and showed per-field errors, staying on step 1.
- Save Draft — reproduced and fixed the bug above, then confirmed a real `201` with `status: "waiting_for_seat"`, `draftReason: "waiting_for_seat"` (consistent with the backend's `Undetermined` seat decision).
- Draft appeared in the list's Onboarding drafts table with correct status/reason/step/starter; "Continue Draft" resumed the wizard at step 1 via a real `GET /api/v1/onboarding/drafts/{id}` fetch.
- Employee detail page: navigating to a non-existent employee ID rendered the safe "could not be found" message with a Retry action — no raw ID or backend error text shown.

**Not performed live** (would require capabilities unavailable in this session): permission-denied unreachable check for a user *without* `employees:read` (no such seeded credential was available — covered instead by `permissionGuard`'s existing unit tests and the route `data.permissions` wiring, which is identical to the already-live-verified `organization`/`settings` routes), duplicate email/employee-number conflict (covered by backend integration tests and handler unit tests, not re-driven through the UI), and concurrent-edit 409 (covered by `OnboardingDraftsIntegrationTests`' real concurrent-write test on the backend side).

## Known gap: detail page

`EmployeeDetailComponent` is a minimal single-section read-only view (employee number, position, department, legal entity, employment type, status, reporting manager). The full section-by-section detail UI from the spec (Personal Info, Emergency Contact, Payroll (masked), Policy/Access Overrides, Documents, Lifecycle, with section-level edit boundaries) is **not implemented** — most of those sections have no corresponding backend data or edit endpoints in this slice (payroll, documents, emergency contact are explicitly out of scope; policy/access-overrides and lifecycle have no backend surface yet). Documented as a gap rather than built against nonexistent data.

## Tests and results

All commands run from `Hrms--Web-application---front-end---v1/` root.

- `ng build` — clean production build.
- `ng test --watch=false` (full suite, via Vitest) — **421/421 passing**, 75 test files, both before and after the live-verification bug fix.
- `git diff --check` scoped to `src/app/modules/people` and `src/app/app.routes.ts` — clean.

## Skipped checks / known limitations

- No final-creation or invitation UI — matches backend scope.
- No permission-denied manual walkthrough with a real restricted credential (see above) — covered by existing guard unit tests instead.
- Detail page is intentionally minimal (see above).
- Schedule/Shift and Checklist Template steps are permanently in an "unavailable" state until a backend source exists.
