# Inbox Case History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a person's earlier cases in the Inbox ticket details: 5 rows of the ticket's month, and a full month-by-month view with red-dot months behind **View all**.

**Architecture:** The backend adds an optional provider interface, `IInboxPersonCaseProvider`, that lists "items about a person" by month. It sits beside the existing `IInboxBulkActionProvider` pattern, so Work and Onboarding implement nothing. The router fans out, and two endpoints sit under `api/v1/inbox/people/{employeeId}` behind `[RequireVisibleEmployee("employeeId")]`. The frontend adds a small component-scoped signal store and three components. Excluding the current ticket and ordering same type first happen client-side, because the client already has the whole month.

**Tech Stack:** ASP.NET Core / EF Core / xUnit (`HRMS-Backend-v1`); Angular 21 standalone + `@ngrx/signals` + Vitest (`Hrms--Web-application---front-end---v1`).

**Spec:** `Hrms--Web-application---front-end---v1/docs/superpowers/specs/2026-10-19-inbox-case-history-design.md`

## Global Constraints

- **No severity column.** Severity shows only as the type icon colour, through `inboxTypeMeta` + `inboxIconTone` (`modules/inbox/utils/inbox-item.util.ts`).
- **Row content is fixed:** type icon · type label · date · status chip. No prose, no counts-as-sentences.
- **Categories never mix:** alert tickets list alerts, request tickets list requests (`item.category`).
- **v1 sources:** `monitoring`, `calendar`, `attendance`, `leave`. `work` and `onboarding` hide the section.
- **Visibility gate:** `RequireVisibleEmployee` only (the caller themselves or someone in the caller's coverage). Rows the caller couldn't open are listed with `canOpen = false` and are not clickable.
- **Muted rows:** cancelled requests only (`status === 'cancelled'`). Every alert counts, Escalated included, and it stays live.
- **Red dot:** a month with at least one item about the person that is not a cancelled request and is not the current ticket.
- **Full view months:** from the hire month through the current month. Any other month is disabled.
- **Section hidden** when the caller is the subject person (`detail.item.direction === 'info'` and subject id === the session employee id).
- **Empty month:** the compact block shows exactly `No other cases this month`.
- **Frontend:** zero build/test warnings (`CLAUDE.md`). Specs mock HTTP and use a fixed clock.
- **Endpoint path:** the endpoint path differs from the spec's `history`, because `GET inbox/history` already exists (the caller's decision journal). These endpoints use `people/{employeeId}/cases` instead.

## Review Focus

- **Month boundary in the viewer's timezone:** a case created 23:30 local on Oct 31 must land in October. The client sends local month bounds and the months endpoint takes `offsetMinutes`. Task 1 and Task 5 pin this.
- **The current ticket in its own month:** it must not appear in the rows, in `View all (N)`, or as the only reason for a red dot. Task 5 pins this.
- **Switching tickets while the full view is open:** it must exit to normal details for the new ticket and must not show the old person's history. Task 8 pins this.
- **A subject the caller can't see (403):** the section hides silently, with no error banner in the card. Task 6 pins this.
- **Hire date in the future or missing:** the month grid still shows the current month enabled. A future hire date clamps to it. Task 7 pins this.

---

## Backend (`C:\onevoNew\HRMS-Backend-v1`)

Test command for all backend tasks: `dotnet test tests/ONEVO.Tests.Unit --filter "<Name>"`. Before each run, re-check for a running `ONEVO.Api.exe` and kill it, because it respawns.

### Task 1: Contracts, router and endpoints

**Files:**
- Modify: `src/ONEVO.Application/Features/Inbox/Contracts/InboxStandardContracts.cs`
- Modify: `src/ONEVO.Application/Features/Inbox/Services/InboxRouter.cs` (interface + class)
- Modify: `src/ONEVO.Api/Controllers/Tenant/Inbox/InboxController.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/Inbox/InboxRouterPersonCasesTests.cs`, `tests/ONEVO.Tests.Unit/Features/Inbox/InboxEndpointsTests.cs`

**Interfaces:**
- Produces (contracts):
  ```csharp
  public sealed record InboxPersonCase(InboxItem Item, bool CanOpen);
  public sealed record InboxPersonCaseMonth(int Month, int Count);
  public sealed record InboxPersonCaseMonths(DateOnly? HireDate, IReadOnlyList<InboxPersonCaseMonth> Months);
  public interface IInboxPersonCaseProvider
  {
      string Source { get; }
      /// <summary>Items in <paramref name="category"/> about <paramref name="subjectEmployeeId"/> created in [from, to),
      /// mapped with direction Info and no actions; CanOpen = the caller's GetDetailAsync would be non-null.</summary>
      Task<IReadOnlyList<InboxPersonCase>> ListPersonCasesAsync(
          Guid tenantId, Guid subjectEmployeeId, string category, DateTimeOffset from, DateTimeOffset to,
          Guid callerEmployeeId, CancellationToken ct);
  }
  ```
- Produces (router, on `IInboxRouter`):
  - `Task<IReadOnlyList<InboxPersonCase>> GetPersonCasesAsync(Guid tenantId, Guid callerEmployeeId, Guid employeeId, string category, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)` returns the providers' rows concatenated and sorted by `Item.CreatedAt` descending.
  - `Task<InboxPersonCaseMonths> GetPersonCaseMonthsAsync(Guid tenantId, Guid callerEmployeeId, Guid employeeId, string category, int year, int offsetMinutes, CancellationToken ct)` lists the local year `[year-01-01, year+1-01-01)` at `offsetMinutes` through the same fan-out. It drops `Status == "cancelled"`, groups by `CreatedAt.ToOffset(offset).Month`, and returns only months with Count > 0, ascending. `HireDate` comes from `IEmployeeRepository` (`Employee.HireDate`).
- Produces (HTTP, both `[RequireVisibleEmployee("employeeId")]`):
  - `GET api/v1/inbox/people/{employeeId:guid}/cases?category=&from=&to=` → `InboxPersonCase[]`
  - `GET api/v1/inbox/people/{employeeId:guid}/cases/months?category=&year=&offsetMinutes=` → `InboxPersonCaseMonths`
  - A `category` other than `alert`/`request` → 400. A range `to <= from` or longer than 31 days → 400.

- [ ] **Step 1: Write failing router tests** in `InboxRouterPersonCasesTests` with two fake `IInboxPersonCaseProvider`s plus one provider that implements only `IInboxSourceProvider`:
  - `GetPersonCasesAsync_MergesProvidersNewestFirst`: dates 10-05, 10-20 and 10-12 come back in the order 10-20, 10-12, 10-05.
  - `GetPersonCasesAsync_PassesCategoryAndRangeThrough`: each fake records its args, and the test asserts `category == "alert"` and the exact from/to.
  - `GetPersonCaseMonthsAsync_GroupsByLocalMonth`: an item at `2026-10-31T19:00Z` with `offsetMinutes = 330` lands in month 11, and an item at `2026-10-31T17:00Z` lands in month 10.
  - `GetPersonCaseMonthsAsync_DropsCancelled`: a month that has only a `cancelled` item does not appear.
  - `GetPersonCaseMonthsAsync_ReturnsHireDate`.
- [ ] **Step 2: Run them.** Expected: FAIL (compile errors: types missing).
- [ ] **Step 3: Implement the contracts and router methods.** The router takes the person-case providers by filtering `_providers.OfType<IInboxPersonCaseProvider>()`. It must not use a separate DI registration, so existing provider registrations stay as they are.
- [ ] **Step 4: Run the router tests.** Expected: PASS.
- [ ] **Step 5: Write failing endpoint tests** in `InboxEndpointsTests`, following that file's existing pattern:
  - `PersonCases_HasRequireVisibleEmployeeOnEmployeeId`: reflect the attribute on both actions and assert `RouteKey == "employeeId"`.
  - `PersonCases_RejectsUnknownCategory` → 400.
  - `PersonCases_RejectsRangeOver31Days` → 400.
- [ ] **Step 6: Add the two controller actions.** Run the endpoint tests. Expected: PASS.
- [ ] **Step 7: Commit:** `feat(inbox): person case history contracts, router and endpoints`

### Task 2: Monitoring + calendar exceptions

**Files:**
- Modify: `src/ONEVO.Application/Features/Monitoring/Exceptions/RepositoryInterfaces/IExceptionRepository.cs` (`ExceptionListFilter`: add `DateTimeOffset? CreatedFrom = null, DateTimeOffset? CreatedTo = null`)
- Modify: `src/ONEVO.Infrastructure/Persistence/Repositories/Monitoring/Exceptions/EfExceptionRepository.cs` (apply `CreatedAt >= CreatedFrom && CreatedAt < CreatedTo`)
- Modify: `src/ONEVO.Application/Features/Monitoring/Exceptions/Inbox/ExceptionInboxSourceProvider.cs`
- Modify: `src/ONEVO.Application/Features/Calendar/Inbox/CalendarMeetingExceptionInbox.cs` (`CalendarInboxSourceProvider`)
- Test: `tests/ONEVO.Tests.Unit/Features/Monitoring/Exceptions/ExceptionInboxTests.cs`, `tests/ONEVO.Tests.Unit/Features/Calendar/Exceptions/CalendarInboxTests.cs`

**Interfaces:**
- Consumes: `IInboxPersonCaseProvider`, `InboxPersonCase` (Task 1).
- Both providers implement `IInboxPersonCaseProvider`. For a `category` other than `alert` they return `[]`.
- Each queries `GetListAsync(tenantId, new ExceptionListFilter(null, null, [subject], null, Calendar: false|true, CreatedFrom: from, CreatedTo: to), 1, ListLimit, ct)` with **no** `ActiveOnly`, so resolved cases are included. Each row is mapped with the provider's existing `Item(...)` using `InboxDirections.Info` and `[]` actions.
- `CanOpen` copies the provider's own `GetDetailAsync` rule:
  - caller is the subject, or
  - `scope.CanAct(id, subject)` from **one** `_scope.ResolveAsync(forAction: true, [subject], ct)`, or
  - the case is in `_conversations.ListAddedSubjectsAsync` (fetched once).

- [ ] **Step 1: Write failing tests** for the monitoring provider:
  - `ListPersonCases_IncludesResolvedCases`
  - `ListPersonCases_ExcludesCalendarTypes`
  - `ListPersonCases_RequestCategoryReturnsEmpty`
  - `ListPersonCases_CanOpenTrueInScope_FalseOutOfScope`
  - `ListPersonCases_MapsAsInfoWithNoActions`

  Mirror these for the calendar provider: `...ExcludesMonitoringTypes`, plus the CanOpen pair.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the filter fields, the EF filter and the two provider methods.
- [ ] **Step 4: Run** `--filter "ExceptionInboxTests|CalendarInboxTests"`. Expected: PASS, including every existing test in those classes.
- [ ] **Step 5: Commit:** `feat(inbox): person case history for monitoring and calendar exceptions`

### Task 3: Attendance alerts + attendance requests

**Files:**
- Modify: `src/ONEVO.Application/Features/TimeAttendance/RepositoryInterfaces/IAttendanceCorrectionRepository.cs`, `IWorkAreaChangeRequestRepository.cs`, `ILocationChangeRequestRepository.cs`, and their EF implementations in `src/ONEVO.Infrastructure/Persistence/Repositories/`
- Modify: `src/ONEVO.Application/Features/TimeAttendance/Inbox/AttendanceInboxSourceProvider.cs`, `AttendanceAlertInbox.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/TimeAttendance/Inbox/AttendanceInboxTests.cs`

**Interfaces:**
- Consumes: Task 1 types.
- New on each of the three repositories: `Task<IReadOnlyList<T>> ListForEmployeeCreatedAsync(Guid tenantId, Guid employeeId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)`, where T is the entity and the filter is created at in `[from, to)`.
- `IDeviceChangeRequestRepository.ListForEmployeeAsync` already exists. Filter its result by created time in memory.
- Alerts come from the existing `IAttendanceAlertRepository.ListForEmployeeAsync(tenantId, employeeId, DateOnly.FromDateTime(from.UtcDateTime), DateOnly.FromDateTime(to.UtcDateTime), ct)`, filtered to `CreatedAt` in `[from, to)`.
- New on `AttendanceAlertInbox`: `Task<IReadOnlyList<InboxPersonCase>> ListPersonCasesAsync(Guid tenantId, Guid subjectEmployeeId, DateTimeOffset from, DateTimeOffset to, Guid callerEmployeeId, CancellationToken ct)`.
- `AttendanceInboxSourceProvider` implements `IInboxPersonCaseProvider`:
  - category `alert` → delegates to `_alerts.ListPersonCasesAsync`
  - category `request` → corrections + work-mode + location + device rows, mapped by the existing `CorrectionRow` / `WorkAreaRow` / `LocationRow` / `DeviceRow` as Info with no actions
- `CanOpen` = the same authority check `GetDetailAsync` uses for that kind, resolved **once** for the subject (`IEmployeeAuthorityResolver`), or caller == subject.

- [ ] **Step 1: Write failing tests:**
  - `ListPersonCases_Request_ReturnsAllFourKindsInRange`: one row of each kind inside the range, plus one correction outside it that must be excluded.
  - `ListPersonCases_Alert_ReturnsAlertsOnly`
  - `ListPersonCases_IncludesFinishedRequests`: approved and rejected rows are present.
  - `ListPersonCases_CanOpenFalseWithoutAuthority`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the repository methods, then the provider methods.
- [ ] **Step 4: Run** `--filter AttendanceInboxTests`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inbox): person case history for attendance alerts and requests`

### Task 4: Leave requests

**Files:**
- Modify: `src/ONEVO.Application/Features/Leave/Request/RepositoryInterfaces/ILeaveRequestRepository.cs` and its EF implementation
- Modify: `src/ONEVO.Application/Features/Leave/Inbox/LeaveInboxSourceProvider.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/Leave/Inbox/LeaveInboxTests.cs`

**Interfaces:**
- New repository method: `Task<IReadOnlyList<LeaveRequest>> ListForEmployeeCreatedAsync(Guid tenantId, Guid employeeId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)`, filtered on created time.
- `LeaveInboxSourceProvider` implements `IInboxPersonCaseProvider`. Category `request` only, otherwise `[]`. Rows are mapped with the provider's existing item mapper as Info with no actions. Status is included, so cancelled rows are kept: the client mutes them and the months endpoint drops them.
- `CanOpen` = the provider's `GetDetailAsync` visibility rule (requester, approver/delegate, or added to chat), evaluated with one approvals lookup for the subject's requests.

- [ ] **Step 1: Write failing tests:**
  - `ListPersonCases_ReturnsAllStatusesInRange`: pending, approved, rejected and cancelled are all present.
  - `ListPersonCases_AlertCategoryReturnsEmpty`
  - `ListPersonCases_CanOpenTrueForApprover_FalseForUninvolved`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `--filter LeaveInboxTests`, then the whole unit project. Expected: PASS, with the same pre-existing failures as on the base branch.
- [ ] **Step 5: Commit:** `feat(inbox): person case history for leave requests`

---

## Frontend (`C:\onevoNew\Hrms--Web-application---front-end---v1`)

Test command: `npx ng test --watch=false --include "src/app/modules/inbox/**"`

### Task 5: DTOs, API methods, pure helpers

**Files:**
- Modify: `src/app/modules/inbox/models/inbox.dto.ts`
- Modify: `src/app/modules/inbox/data-access/inbox-api.service.ts` (+ `.spec.ts`)
- Create: `src/app/modules/inbox/utils/person-cases.util.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces DTOs:
  ```ts
  export interface InboxPersonCaseDto { item: InboxItemDto; canOpen: boolean; }
  export interface InboxPersonCaseMonthDto { month: number; count: number; }
  export interface InboxPersonCaseMonthsDto { hireDate: string | null; months: InboxPersonCaseMonthDto[]; }
  ```
- Produces API methods on `InboxApiService`:
  - `personCases(employeeId: string, category: InboxCategory, from: string, to: string): Observable<InboxPersonCaseDto[]>`
  - `personCaseMonths(employeeId: string, category: InboxCategory, year: number, offsetMinutes: number): Observable<InboxPersonCaseMonthsDto>`
- Produces helpers in `person-cases.util.ts`:
  - `PERSON_CASE_SOURCES: ReadonlySet<string>` = `monitoring`, `calendar`, `attendance`, `leave`
  - `personCaseSubjectId(item: InboxItemDto): string | null` → `item.requestedBy?.id ?? null`
  - `localMonthBounds(year: number, month: number): { from: string; to: string }` (month is 1-based, local midnight, ISO)
  - `orderPersonCases(cases: InboxPersonCaseDto[], current: InboxItemDto): InboxPersonCaseDto[]`: drops the current ref, puts same `source+kind+actionType` first, and sorts each group newest first
  - `isMutedPersonCase(item: InboxItemDto): boolean` → `item.category === 'request' && item.status === 'cancelled'`
  - `redDotMonths(months: InboxPersonCaseMonthDto[], year: number, current: InboxItemDto): Set<number>`: subtracts 1 from the current ticket's local month when that month is in `year` and the ticket isn't a cancelled request, and keeps months whose count is greater than 0

- [ ] **Step 1: Write failing specs:**
  - The API calls hit `${base}/inbox/people/e1/cases` with params `category`, `from`, `to`, and `.../cases/months` with `category`, `year`, `offsetMinutes`.
  - `orderPersonCases` excludes the current item and puts the same type first.
  - `localMonthBounds(2026, 10)` gives a `from` of local Oct 1 00:00 and a `to` of local Nov 1 00:00. Use `vi.setSystemTime` and a fixed timezone (`TZ`) the way existing specs do.
  - `isMutedPersonCase` is true for a cancelled request and false for a resolved alert.
  - `redDotMonths` drops a month whose only count is the current ticket.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inbox): person case DTOs, api and helpers`

### Task 6: `InboxPersonCasesStore`

**Files:**
- Create: `src/app/modules/inbox/state/inbox-person-cases.store.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: Task 5.
- Produces: a `signalStore` (not `providedIn: 'root'`; it is provided by `InboxPageComponent`).
  - State: `current: InboxItemDto | null`, `compact: InboxPersonCaseDto[]`, `compactLoading`, `viewOpen: boolean`, `year`, `month`, `monthCases: InboxPersonCaseDto[]`, `monthLoading`, `dots: Set<number>`, `hireDate: string | null`, `hidden: boolean`.
  - `load(current: InboxItemDto | null, selfEmployeeId: string | null): void`:
    - Resets everything and closes the view.
    - Sets `hidden` when the source isn't in `PERSON_CASE_SOURCES`, the subject is null, or the subject is the caller.
    - Otherwise fetches the ticket's local month into `compact`, ordered.
  - `openView(): void`: copies `compact` into `monthCases`, sets year/month to the ticket's month, and fetches the months for that year.
  - `closeView(): void`
  - `goToMonth(year: number, month: number): void`: fetches that month, and refetches dots when the year changes.
  - Computed `compactRows`: the first 5 of `compact`. `moreCount`: `compact.length` when it is greater than 5, else 0.
  - Any HTTP error (403 included) sets `hidden = true` and shows nothing else. Responses for a ticket that is no longer `current` are ignored.

- [ ] **Step 1: Write failing specs** (mock `InboxApiService` with `vi.fn`, as in `inbox.store.spec.ts`):
  - `load` fetches the ticket's month, excluding the current ticket.
  - `compactRows` caps at 5, and `moreCount` is 7 for 7 rows and 0 for 5.
  - A `work` ticket → `hidden` with no HTTP call.
  - The subject is the caller → `hidden`.
  - A 403 → `hidden`, with no error state.
  - `openView` fetches the months for the ticket's year. `goToMonth` to a new year fetches months again, and to the same year does not.
  - A late response from a previous ticket is ignored.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inbox): person case history store`

### Task 7: Row, compact block and month grid components

**Files:**
- Create: `src/app/modules/inbox/ui/person-cases/person-case-row.component.ts`
- Create: `src/app/modules/inbox/ui/person-cases/person-cases-section.component.ts`
- Create: `src/app/modules/inbox/ui/person-cases/person-case-month-grid.component.ts`
- Create: a `.spec.ts` for each
- Modify: `src/app/modules/inbox/ui/inbox-item-card/inbox-item-card.component.ts`: render `<app-person-cases-section>` just before `<app-ticket-participants>` (line ~128)

**Interfaces:**
- `app-person-case-row`
  - Inputs: `case: InboxPersonCaseDto` (required), `descriptor: InboxKindDescriptorDto | null`.
  - Output: `open: InboxItemRef`, emitted only when `canOpen`.
  - Renders `app-inbox-type-icon` with `inboxTypeMeta(item, descriptor).icon` and `inboxIconTone(item, meta)`, then the meta label, then the date (`d MMM`), then a `card__pill`-style chip with `inboxStatusLabel` / `inboxStatusTone`.
  - Gets class `--muted` when `isMutedPersonCase`, and `aria-disabled` plus no pointer when `!canOpen`.
- `app-person-cases-section`
  - Injects `InboxPersonCasesStore`. Renders nothing when `hidden`.
  - Heading `Past cases`, then rows from `compactRows`.
  - Shows `No other cases this month` when the month is empty and not loading.
  - Shows `View all (N)` when `moreCount > 0`, and `View history` otherwise. Both call `store.openView()`.
  - Output: `open: InboxItemRef`.
- `app-person-case-month-grid`
  - Inputs: `year`, `selectedMonth`, `dots: Set<number>`, `hireDate: string | null`, `today: Date`.
  - Outputs: `pick: { year: number; month: number }`, `yearChange: number`.
  - Shows 12 month cells (`Jan`…`Dec`), with a red dot element (`.pcg__dot`) on months in `dots`.
  - Disables months before the hire month and after today's month. A missing hire date means no lower bound, and a future hire date clamps to today.
  - The year arrows are disabled outside that range.
- The card gets a new output, `openCase: InboxItemRef`, re-emitted from the section.

- [ ] **Step 1: Write failing specs:**
  - The row shows no severity text, renders the icon tone `danger` for an open high-severity alert and `neutral` for a resolved one, gets `--muted` for a cancelled request, and does not emit `open` when `canOpen` is false.
  - The section shows 5 rows and `View all (7)`, shows the empty line with `View history`, and renders nothing when hidden.
  - The grid puts dots on exactly the given months, disables months after today and before the hire month, and clamps a future hire date to the current month being enabled.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use the existing `--color-*` tokens and the dot colour `var(--color-danger)`. Wrap the full list in the `.scroll-fade` scroller later (Task 8). No new table markup.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inbox): past cases section, row and month grid`

### Task 8: Full history view + page wiring

**Files:**
- Create: `src/app/modules/inbox/ui/person-cases/person-cases-view.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/inbox/feature/inbox-page/inbox-page.component.ts` (+ `.spec.ts`)

**Interfaces:**
- `app-person-cases-view`
  - Injects the store. Output: `open: InboxItemRef`.
  - Header: a `← Back` button (`store.closeView()`), the subject name from `current.requestedBy.name`, and the label `Alerts` or `Requests`.
  - Switcher: `‹`, a month label button (`October 2026`) that toggles `app-popover` holding the month grid, and `›`. The prev/next buttons respect the same bounds as the grid.
  - Body: rows from `monthCases` in a `.scroll-fade` scroller, and the empty line `No other cases this month` when there are none.
- `InboxPageComponent`
  - Adds `providers: [InboxPersonCasesStore]`.
  - An `effect` calls `personCases.load(store.detail()?.item ?? null, <session employee id>)` whenever the selected ticket changes. Use the id source the page already uses for self checks.
  - Inside `aside.inbox__details`: shows `app-person-cases-view` when `personCases.viewOpen()`, and otherwise `app-inbox-item-card`.
  - Both `open` / `openCase` events call `store.select(ref)`, the same path as a list click.

- [ ] **Step 1: Write failing specs:**
  - The view's Back calls `closeView`. `‹` from October requests September bounds. The popover grid `pick` calls `goToMonth`.
  - On the page, View all swaps the card for the view. Selecting another ticket returns to the card, and `load` is called with the new ticket. The narrow drawer shows the view inside the drawer.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the inbox specs, then `npm run check:warnings`. Expected: all PASS, and the warnings check reports no `[WARNING]` or `[ERROR]`.
- [ ] **Step 5: Commit:** `feat(inbox): full person case history view`

### Task 9: Live check

- [ ] **Step 1:** Restart the API and run the frontend dev server (`.claude/launch.json`).
  - Sign in as a manager of an employee who has several exceptions across two months.
  - Open one case and confirm: at most 5 rows, same type first, the current case absent, the icon colours match the list, and there is no severity text.
- [ ] **Step 2:** Click View all and confirm:
  - the details pane swaps
  - Back returns
  - the month switch fetches
  - red dots appear only on months that have other cases
  - months after today and before the hire date are disabled
- [ ] **Step 3:** Open a leave request and confirm only requests are listed. Open a Work item and confirm the section is absent.
- [ ] **Step 4:** Take a screenshot as proof. Record any deviations in the plan's notes.
